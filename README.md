StatsD Zabbix Backend
=====================
Convey metrics from statsd to Zabbix

Design
======
For the time being, this actually just shells out to `zabbix_sender`, though
in the future it will hopefully talk to the RPC directly. As such, you'll have
to make sure that you have it installed on the system with statsd

Installation
============
In `statsd/backends`:

    git clone https://github.com/dlecocq/statsd-zabbix

Configuration
=============
Add `./backends/statsd-zabbix` to your `backends` configuraiton key, and then
add `zabbix_sender`-specific configuration in the `zabbix` key:

    # Your selected backends
    backends: ['./backends/statsd-zabbix'],

    # And now for zabbix-specific configuration. These options are meant to
    # mimic closely the actual arguments to `zabbix_sender`
    zabbix: {
        # Required, the path to your zabbix_sender binary
        sender: '/usr/bin/zabbix_sender',

        # Optional, a path to a zabbix_sender configuration file
        config: '/etc/zabbix/zabbix_agentd.conf',

        # Optional, port to connect to on the zabbix server
        'zabbix-server': '127.0.0.1',

        # Optional, the name of this host in zabbix
        host: 'statsd',

        # Optional, the source IP address
        'source-address': '...'
    }

To-Do
=====
It's not a very big priority, but at some point, I'd like to use the RPC
interface instead of having to shell out to `zabbix_sender`.