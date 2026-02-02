/**
 * Node-RED nodes for Process Link Files API
 * https://files.processlink.com.au
 */

module.exports = function (RED) {
  const https = require("https");
  const http = require("http");

  // ============================================
  // Config Node - Stores Site ID and API Key
  // ============================================
  function ProcessLinkConfigNode(config) {
    RED.nodes.createNode(this, config);
    this.name = config.name;
    this.siteId = config.siteId;
    // API key is stored in this.credentials.apiKey (encrypted by Node-RED)
  }

  RED.nodes.registerType("processlink-files-config", ProcessLinkConfigNode, {
    credentials: {
      apiKey: { type: "password" },
    },
  });

  // ============================================
  // Upload Node - Uploads files to the API
  // ============================================
  function ProcessLinkUploadNode(config) {
    RED.nodes.createNode(this, config);
    const node = this;

    // Get the config node
    this.server = RED.nodes.getNode(config.server);

    node.on("input", function (msg, send, done) {
      // For Node-RED 0.x compatibility
      send = send || function () { node.send.apply(node, arguments); };
      done = done || function (err) { if (err) node.error(err, msg); };

      // Validate config
      if (!node.server) {
        node.status({ fill: "red", shape: "ring", text: "no config" });
        done(new Error("No Process Link configuration selected"));
        return;
      }

      const siteId = node.server.siteId;
      const apiKey = node.server.credentials?.apiKey;

      if (!siteId) {
        node.status({ fill: "red", shape: "ring", text: "no site ID" });
        done(new Error("Site ID not configured"));
        return;
      }

      if (!apiKey) {
        node.status({ fill: "red", shape: "ring", text: "no API key" });
        done(new Error("API Key not configured"));
        return;
      }

      // Validate payload
      let fileBuffer;
      if (Buffer.isBuffer(msg.payload)) {
        fileBuffer = msg.payload;
      } else if (typeof msg.payload === "string") {
        fileBuffer = Buffer.from(msg.payload);
      } else {
        node.status({ fill: "red", shape: "ring", text: "invalid payload" });
        done(new Error("msg.payload must be a Buffer or string"));
        return;
      }

      // Get filename
      const filename = msg.filename || config.filename || "file.bin";
      const basename = filename.split(/[\\/]/).pop();

      // Build multipart form data
      const boundary = "----NodeREDProcessLink" + Date.now() + Math.random().toString(36).substring(2);

      const header = Buffer.from(
        `--${boundary}\r\n` +
        `Content-Disposition: form-data; name="file"; filename="${basename}"\r\n` +
        `Content-Type: application/octet-stream\r\n\r\n`
      );
      const footer = Buffer.from(`\r\n--${boundary}--\r\n`);
      const body = Buffer.concat([header, fileBuffer, footer]);

      // Parse URL
      const apiUrl = config.apiUrl || "https://files.processlink.com.au/api/upload";
      const url = new URL(apiUrl);
      const isHttps = url.protocol === "https:";

      const options = {
        hostname: url.hostname,
        port: url.port || (isHttps ? 443 : 80),
        path: url.pathname,
        method: "POST",
        headers: {
          "Content-Type": `multipart/form-data; boundary=${boundary}`,
          "Content-Length": body.length,
          "x-site-id": siteId,
          "x-api-key": apiKey,
        },
      };

      node.status({ fill: "yellow", shape: "dot", text: "uploading..." });

      const transport = isHttps ? https : http;
      const req = transport.request(options, (res) => {
        let responseData = "";

        res.on("data", (chunk) => {
          responseData += chunk;
        });

        res.on("end", () => {
          let parsedResponse;
          try {
            parsedResponse = JSON.parse(responseData);
          } catch (e) {
            parsedResponse = { raw: responseData };
          }

          msg.payload = parsedResponse;
          msg.statusCode = res.statusCode;
          msg.headers = res.headers;

          if (res.statusCode === 201 && parsedResponse.ok) {
            // Success
            msg.file_id = parsedResponse.file_id;
            node.status({
              fill: "green",
              shape: "dot",
              text: `uploaded: ${parsedResponse.file_id?.substring(0, 8)}...`,
            });
            send(msg);
            done();

            // Clear status after 5 seconds
            setTimeout(() => node.status({}), 5000);
          } else {
            // API error
            const errorMsg = parsedResponse.error || parsedResponse.message || `HTTP ${res.statusCode}`;
            node.status({ fill: "red", shape: "dot", text: errorMsg });

            // Still send the message so users can handle errors in their flow
            send(msg);
            done();

            // Clear status after 10 seconds
            setTimeout(() => node.status({}), 10000);
          }
        });
      });

      req.on("error", (err) => {
        node.status({ fill: "red", shape: "ring", text: "request failed" });
        msg.payload = { error: err.message };
        msg.statusCode = 0;
        send(msg);
        done(err);

        setTimeout(() => node.status({}), 10000);
      });

      // Set timeout
      const timeout = parseInt(config.timeout) || 30000;
      req.setTimeout(timeout, () => {
        req.destroy();
        node.status({ fill: "red", shape: "ring", text: "timeout" });
        msg.payload = { error: "Request timed out" };
        msg.statusCode = 0;
        send(msg);
        done(new Error("Request timed out"));

        setTimeout(() => node.status({}), 10000);
      });

      req.write(body);
      req.end();
    });

    node.on("close", function () {
      node.status({});
    });
  }

  RED.nodes.registerType("processlink-files-upload", ProcessLinkUploadNode);
};
