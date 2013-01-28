/* Copyright (c) 2012 SEOmoz
 *
 * Permission is hereby granted, free of charge, to any person obtaining
 * a copy of this software and associated documentation files (the
 * "Software"), to deal in the Software without restriction, including
 * without limitation the rights to use, copy, modify, merge, publish,
 * distribute, sublicense, and/or sell copies of the Software, and to
 * permit persons to whom the Software is furnished to do so, subject to
 * the following conditions:
 *
 * The above copyright notice and this permission notice shall be
 * included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
 * EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
 * MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
 * NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE
 * LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
 * OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
 * WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE. */

var proc = require('child_process');

var sum = function(arr) {
    /* Just a little helper to return the sum of an array */
    return arr.reduce(function(a, b) { return a + b; }, 0);
};

function ZabbixClient(config) {
    /* Save our configuration */
    this.config = config;

    /* These are our stats */
    this.stats = {
        'flushes': 0,
        'last_flushed': 0
    };

    /* Let's be optimistic and say this is valid */
    this.valid = true;

    /* Now we should build the command */
    if (!config.zabbix.sender) {
        /* If there is no path to the zabbix command, we should bail */
        this.valid = false;
    }

    /* Let's build up all the arguments we'll need, and then we'll join them
     * together later */
    var args = [config.zabbix.sender, '-T', '-i', '-'];
    
    /* The configuration option mapped onto the flags */
    var mapping = {
        'config'        : '-c',
        'zabbix-server' : '-z',
        'port'          : '-p',
        'host'          : '-s',
        'source-address': '-I'
    };

    for (var key in mapping) {
        if (config.zabbix[key]) {
            args.push(mapping[key], config.zabbix[key]);
        }
    }

    this.command = args.join(' ');
}

ZabbixClient.prototype.sanitize = function(key) {
    return key.replace(/[\/]/g, '.')
}

ZabbixClient.prototype.flush = function(timestamp, metrics) {
    /* Save out when we last flushed */
    this.stats.last_flushed = timestamp;
    this.stats.flushes += 1;

    /* Save out our results */
    var results = [];

    /* Get all the counters' data together */
    for (var key in metrics.counters) {
        /* The value of the counter, and the value per second */
        var value = metrics.counters[key];
        results.push({
            'key'  : key,
            'total': value,
            'avg'  : value / (this.config.flushInterval / 1000)
        });
    }

    /* Get all of the timers data */
    for (key in metrics.timers) {
        /* If there are no items, then we can skip this one */
        if (metrics.timers[key].length === 0) {
            console.warn('Bad key: ' + key);
            continue;
        }

        /* If we do have items, however, */
        var values = metrics.timers[key].sort(function(a, b) { return a - b; });
        var count  = values.length;
        var mean   = sum(values) / count;
        var max    = values[count - 1];
        var min    = values[0];

        /* To-do */
        for (var index in metrics.pctThreshold) {
            var pct = metrics.pctThreshold[index];
        }

        results.push({
            'key'  : key,
            'upper': max,
            'lower': min,
            'count': count,
            'mean' : mean
        });
    }

    /* And lastly, all of the gauges */
    for (key in metrics.gauges) {
        results.push({
            'key'  : key,
            'value': metrics.gauges[key]
        });
    }

    this.post(timestamp, results);
};

ZabbixClient.prototype.post = function(timestamp, results) {
    var entries = [];
    for (var index in results) {
        var datum = results[index];
        for (var key in datum) {
            if (key == 'value') {
                /* Then this is just the raw value of the metric */
                entries.push([
                    this.config.zabbix.host,
                    this.sanitize(datum['key']),
                    timestamp,
                    datum[key]
                ].join(' '));
            } else if (key != 'key') {
                /* Or it's a quantity like the mean, max, etc. */
                entries.push([
                    this.config.zabbix.host,
                    this.sanitize(datum['key'] + '.' + key),
                    timestamp,
                    datum[key]
                ].join(' '));
            }
        }
    }

    var string = entries.join("\n");

    try {
        /* Optionally print out our command */
        if (this.config.debug) {
            console.log('Running command: ' + this.command);
            console.log('        Writing: ' + string);
        }

        /* Bind this for the callback */
        var me = this;
        var exec = proc.exec(this.command, function(error, stdout, stderr) {
            if (error && me.config.debug) {
                console.warn('Error running ' + me.config.cmd);
                console.warn(error);
            }
        });

        exec.stdin.write(string);
        exec.stdin.end();
    } catch(e) {
        if (this.config.debug) {
            console.warn(e);
        }
    }
};

ZabbixClient.prototype.status = function(cb) {
    for (var key in this.stats) {
        cb(null, 'zabbix', key, this.stats[key]);
    }
};

exports.init = function(startup_time, config, events) {
    var client = new ZabbixClient(config);

    events.on('flush' , function(timestamp, metrics) {
        client.flush(timestamp, metrics);
    });

    events.on('status', function(cb) {
        client.status(cb);
    });

    /* Return success */
    return client.valid;
};
