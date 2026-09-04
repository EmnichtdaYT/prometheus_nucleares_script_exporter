# Script for Nucleares and script_exporter

This is a script for the game Nucleares which transformes the data from the Nucleares webserver into prometheus metrics. This script is intended to be used with the script_exporter for prometheus by ricoberger.

## Grafana dashboard

Here is my WIP example dashboard

![A screenshot of a grafana dashboard showing a few visualizations for Nucleares](grafana_example_dashboard.png)

Code: grafana_example_dashboard.json

## script_exporter config

Here is my example config for script_exporter

```yaml
scripts:
  -
    name: Nucleares
    command:
      - ./nucleares_batch.js
    output:
      ignore_on_error: true
      format: prometheus
    cache:
      duration: 0
```

Here is my example config for prometheus:

```yaml
- job_name: Nucleares
  static_configs:
    - targets: ['192.168.0.99:9469']
  metrics_path: /probe
  params:
    script:
      - Nucleares
  scrape_interval: 5s
  scrape_timeout: 4s

```