#!/usr/bin/node

/*
this does not include:
VALVE_PANEL_JSON
AO_AGENT_DIAGNOSTICS_JSON

handled differently:
TIME
*/
const ENDPOINT = "http://localhost:8785/?variable=WEBSERVER_BATCH_GET";

const ALLOWED_NULL_OR_EMPTY = [ // Currently we do nothing with the following empty values:

    // I don't know how they work yet:

    "RODS_STATUS",
    "RODS_MOVEMENT_SPEED",
    "RODS_MOVEMENT_SPEED_DECREASED_HIGH_TEMPERATURE",
    "RODS_DEFORMED",
    "RODS_TEMPERATURE",
    "RODS_MAX_TEMPERATURE",
    "RODS_POS_ORDERED",
    "RODS_POS_REACHED",

    // Some values for steam generators and rod banks the player does not have show up as null:

    "STEAM_GEN_0_OUTLET",
    "STEAM_GEN_0_EVAPORATED",
    "STEAM_GEN_0_BOILING_POINT",
    "STEAM_GEN_0_INLET",
    "STEAM_GEN_0_RETURN_FLOW_PLUS_CONDENSED",
    "STEAM_GEN_1_OUTLET",
    "STEAM_GEN_1_EVAPORATED",
    "STEAM_GEN_1_BOILING_POINT",
    "STEAM_GEN_1_INLET",
    "STEAM_GEN_1_RETURN_FLOW_PLUS_CONDENSED",
    "ROD_BANK_POS_1_ACTUAL",
    "ROD_BANK_POS_2_ACTUAL",
    "ROD_BANK_POS_3_ACTUAL",
    "ROD_BANK_POS_4_ACTUAL",
    "ROD_BANK_POS_5_ACTUAL",
    "ROD_BANK_POS_6_ACTUAL",
    "ROD_BANK_POS_7_ACTUAL",
    "ROD_BANK_POS_8_ACTUAL",

    // I don't know wtf this is:

    "FUN_IS_ENABLED",
];

async function get_metrics() {
  await fetch(ENDPOINT)
    .then((response) => response.json())
    .then((response) => {

        /*
        dev, why?
        EMERGENCY_BATTERIES_MODE: 1 = Automatic, 2 = Charge, 3 = Use
        CONDENSER_VACUUM_PUMP_MODE: OPERACIONAL = 1, STARTUP = 2
        EMERGENCY_GENERATOR_1_MODE: AUTOMATICO = 1, MANUAL = 2
        EMERGENCY_GENERATOR_1_STATUS: INACTIVO = 0, INICIANDO = 1
        EMERGENCY_GENERATOR_1_PRESSURIZER: INACTIVO = 0, PRESURIZANDO = 1

        misc stuff
        GAME_VERSION V 2.2.25.221
        ALARMS_ACTIVE GENERATOR - LOW INTEGRITY TURBINE 3 (this is a comma seperated list A,B,C,D)
        */

        console.log(
          "#HELP EMERGENCY_BATTERIES_MODE Mode switch of the emergency batteries. 1 = Automatic, 2 = Charge, 3 = Use",
        );
        console.log(
          "#HELP ALARMS_ACTIVE Active alarms count with extra labels for each active alarm",
        );
  
        let parse_failed_metrics = [];

        for (metric_name in response.values) {
            if (metric_name !== "TIME")
                //We process time differently
                if(print_metric(metric_name, response.values[metric_name]) === false){ // if the return value was false we couldnt parse the metric
                    parse_failed_metrics.push(metric_name)
                }
        }

        // metric for all the metrics we couldnt parse
        console.log(
          "#HELP METRIC_PARSE_FAILED Sum of metrics which didn't get parsed sucessfully with labels for the failed ones.",
        );

        let parse_failed_metrics_string = '';
        for(failed_metric in parse_failed_metrics){
            parse_failed_metrics_string += `\"${parse_failed_metrics[failed_metric]}\"=\"1\",`
        }

        parse_failed_metrics_string=parse_failed_metrics_string.slice(0, -1) //remove last ','

        console.log(`METRIC_PARSE_FAILED{${parse_failed_metrics_string}} ${parse_failed_metrics.length}`)


        // TIME metric
        console.log(
          "#HELP TIME_MINUTES Ingame day and time in minutes since day 0, 00:00. Use this to correlate your data.",
        );
        let time_minutes = response.values["TIME_DAY"]*24*60
            + response.values["TIME"].split(":")[0]*60
            + response.values["TIME"].split(":")[1]*1;

        console.log("TIME_MINUTES", time_minutes)

    });
}

function print_metric(metric_name, value) {

  if (typeof value === "string" && value.startsWith("-")) {
    // for WHAETEVER FUCKING REASON, some negative numbers show up as string in here
    try {
      value = Number(value);
    } catch {}
  }

  if (value === null || value === "") {
    if (metric_name == "ALARMS_ACTIVE") { // handling for metrics we already know how they work

        console.log("ALARMS_ACTIVE 0"); // if its empty or null we dont have any active alarms

    } else if (!ALLOWED_NULL_OR_EMPTY.includes(metric_name)) {
        return false; // return false if we couldnt parse the metric properly.
    }

  } else if (typeof value === "boolean") {
    // we convert boolean to 1 and 0
    console.log(`# HELP ${metric_name} boolean: true = 1, false = 0`)
    console.log(metric_name, +value)
  } else if (Number.isFinite(value)) {
    // if the metric is already a number we can just use it
    console.log(metric_name, value)
  } else if (value.toString().startsWith("{")) {
    // a cursed way to check if its json. I only expect AO_AGENT_STATUS to end up here. VALVE_PANEL_JSON, AO_AGENT_DIAGNOSTICS_JSON and prob. some more also exists, but it isn't included in this request.
    // TODO: implement
  } else {
    // different metrics, most of them are strings but all in slightly different formatting
    if (metric_name == "GAME_VERSION") {

        console.log(
            "#HELP GAME_VERSION Game version as label 'version'. Metric value always 1",
        );
        console.log(`GAME_VERSION{\"version\"=\"${value}\"} 1`);

    } else if (metric_name == "ALARMS_ACTIVE") {

        let alarms_total_count = value.split(",").length; // total amount of currently active alarms
        let alarm_active_formatted = '\"' + value.replaceAll(" ", "_").replaceAll(",", '\"=\"1\",') + '\"=\"1\"';

        console.log(
            `ALARMS_ACTIVE{${alarm_active_formatted}} ${alarms_total_count}`,
        );

    } else if (metric_name == "CONDENSER_VACUUM_PUMP_MODE") {

      console.log(
        "#HELP CONDENSER_VACUUM_PUMP_MODE Condenser vacuum pump mode switch. 1 = Operational (OPERACIONAL), 2 = Startup",
      );

      switch (value) {
        case "OPERACIONAL":
          console.log("CONDENSER_VACUUM_PUMP_MODE 1");
          break;
        case "STARTUP":
          console.log("CONDENSER_VACUUM_PUMP_MODE 2");
          break;
        default:
          return false; //return false if we couldnt parse the metric properly.
      }
    
    } else if (/EMERGENCY_GENERATOR_\d_MODE/.test(metric_name)) {

      console.log(
        `#HELP ${metric_name} Emergency generator mode switch. 1 = Automatic (AUTOMATICO), 2 = Manual`,
      );

      switch (value) {
        case "AUTOMATICO":
          console.log(`${metric_name} 1`);
          break;
        case "MANUAL":
          console.log(`${metric_name} 2`);
          break;
        default:
          return false; //return false if we couldnt parse the metric properly.
      }
    
    } else if (/EMERGENCY_GENERATOR_\d_STATUS/.test(metric_name)) {

      console.log(
        `#HELP ${metric_name} Emergency generator status. 0 = Off (INACTIVO), 1 = Running (INICIANDO)`,
      );

      switch (value) {
        case "INACTIVO":
          console.log(`${metric_name} 0`);
          break;
        case "INICIANDO":
          console.log(`${metric_name} 1`);
          break;
        default:
          return false; //return false if we couldnt parse the metric properly.
      }

    } else if (/EMERGENCY_GENERATOR_\d_PRESSURIZER/.test(metric_name)) {

      console.log(
        `#HELP ${metric_name} Emergency generator fuel pressurizer status. 0 = Off (INACTIVO), 1 = Pressurized (PRESURIZANDO)`,
      );

      switch (value) {
        case "INACTIVO":
          console.log(`${metric_name} 0`);
          break;
        case "PRESURIZANDO":
          console.log(`${metric_name} 1`);
          break;
        default:
          return false; //return false if we couldnt parse the metric properly.
      }

    } else {
        return false; //return false if we couldnt parse the metric properly.
    }
  }
}

get_metrics(); // entry point
