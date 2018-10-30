"use strict";

let baseUrl = "https://api.mackerelio.com";
var request = require('request');

module.exports = function (RED) {
    function MackerelNode(n) {
        RED.nodes.createNode(this, n);
        var node = this;
        var nodePath = n.path;
        var isTemplatedUrl = (nodePath || "").indexOf("{{") != -1;
        var nodeMethod = n.method || "GET";
        if (RED.settings.httpRequestTimeout) {
            this.reqTimeout = parseInt(RED.settings.httpRequestTimeout) || 120000;
        } else {
            this.reqTimeout = 120000;
        }
        this.config = RED.nodes.getNode(n.config);

        this.on("input", function (msg) {
            var preRequestTimestamp = process.hrtime();
            node.status({
                fill: "blue",
                shape: "dot",
                text: "mackerel.status.requesting"
            });

            var url = nodePath || msg.path;
            if (msg.path && nodePath && (nodePath !== msg.path)) { // revert change below when warning is finally removed
                node.warn(RED._("common.errors.nooverride"));
            }
            if (isTemplatedUrl) {
                // XXX ReferenceError: mustache is not defined
                url = mustache.render(url, msg);
            }
            if (!url) {
                node.error(RED._("mackerel.errors.no-path"), msg);
                node.status({
                    fill: "red",
                    shape: "ring",
                    text: (RED._("mackerel.errors.no-path"))
                });
                return;
            }

            if (!((url.indexOf("http://") === 0) || (url.indexOf("https://") === 0))) {
                url = baseUrl + url;
            }

            var method = nodeMethod.toUpperCase() || "GET";
            if (msg.method && n.method && (n.method !== "use")) { // warn if override option not set
                node.warn(RED._("common.errors.nooverride"));
            }
            if (msg.method && n.method && (n.method === "use")) {
                method = msg.method.toUpperCase(); // use the msg parameter
            }
            var opts = {
                method: method,
                url: url,
                timeout: node.reqTimeout,
                headers: {},
                encoding: null,
            };
            opts.headers["X-API-Key"] = this.config.api_key;

            if (msg.payload && (method == "POST" || method == "PUT" || method == "PATCH")) {
                opts.body = JSON.stringify(msg.payload);
                opts.headers['content-type'] = "application/json";
            }

            request(opts, function (error, response, body) {
                node.status({});
                if (error) {
                    if (error.code === 'ETIMEDOUT') {
                        node.error(RED._("common.notification.errors.no-response"), msg);
                        setTimeout(function () {
                            node.status({
                                fill: "red",
                                shape: "ring",
                                text: "common.notification.errors.no-response"
                            });
                        }, 10);
                    } else {
                        node.error(error, msg);
                        msg.payload = error.toString() + " : " + url;
                        msg.statusCode = error.code;
                        node.send(msg);
                        node.status({
                            fill: "red",
                            shape: "ring",
                            text: error.code
                        });
                    }
                } else {
                    msg.payload = body;
                    try { msg.payload = JSON.parse(msg.payload); }
                    catch (e) { node.warn(RED._("mackerel.errors.json-error")); }
                    msg.headers = response.headers;
                    msg.statusCode = response.statusCode;
                    if (node.metric()) {
                        // Calculate request time
                        var diff = process.hrtime(preRequestTimestamp);
                        var ms = diff[0] * 1e3 + diff[1] * 1e-6;
                        var metricRequestDurationMillis = ms.toFixed(3);
                        node.metric("duration.millis", msg, metricRequestDurationMillis);
                        if (response.connection && response.connection.bytesRead) {
                            node.metric("size.bytes", msg, response.connection.bytesRead);
                        }
                    }

                    node.send(msg);
                }
            })
        });
    }
    function MackerelConfig(n) {
        RED.nodes.createNode(this, n);

        if (this.credentials) {
            this.api_key = this.credentials.api_key;
        }
    }

    RED.nodes.registerType("mackerel", MackerelNode, {
    });
    RED.nodes.registerType("mackerel-config", MackerelConfig, {
      credentials: {
        api_key: {
            type: "password"
        }
      }
    });
}