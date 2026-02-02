# @processlink/node-red-contrib-processlink-files

Node-RED node to upload files to [Process Link Files](https://files.processlink.com.au) API.

## Installation

### Via Node-RED Palette Manager (Recommended)

1. Open Node-RED
2. Go to **Menu → Manage palette → Install**
3. Search for `@processlink/node-red-contrib-processlink-files`
4. Click **Install**

### Via npm

```bash
cd ~/.node-red
npm install @processlink/node-red-contrib-processlink-files
```

Then restart Node-RED.

## Quick Start

1. **Get your credentials** from the [Process Link Files](https://files.processlink.com.au) app:
   - Go to your site's **Settings → API Keys**
   - Click **Generate API Key**
   - Copy the **Site ID** and **API Key**

2. **Add the node** to your flow:
   - Find **PL Upload** in the palette under "Process Link"
   - Drag it into your flow

3. **Configure credentials**:
   - Double-click the node
   - Click the pencil icon next to "Config"
   - Enter your **Site ID** and **API Key**
   - Click **Add**, then **Done**

4. **Connect a file source**:
   - Use a **File In** node to read files
   - Connect it to the Process Link Upload node

## Node Reference

### Process Link Upload

Uploads files to the Process Link Files API.

#### Inputs

| Property | Type | Description |
|----------|------|-------------|
| `msg.payload` | Buffer \| string | The file content to upload |
| `msg.filename` | string | (Optional) Filename to use |

#### Outputs

| Property | Type | Description |
|----------|------|-------------|
| `msg.payload` | object | API response with `ok`, `file_id`, `created_at` |
| `msg.file_id` | string | The UUID of the uploaded file |
| `msg.statusCode` | number | HTTP status code (201 on success) |

#### Status Indicators

- 🟡 Yellow: Uploading in progress
- 🟢 Green: Upload successful
- 🔴 Red: Error occurred

## Example Flows

### Basic File Upload

Upload a file from disk:

```json
[
    {
        "id": "file-in-node",
        "type": "file in",
        "name": "Read File",
        "filename": "/path/to/your/file.pdf",
        "format": "",
        "chunk": false,
        "sendError": false,
        "encoding": "none",
        "allProps": true,
        "wires": [["upload-node"]]
    },
    {
        "id": "upload-node",
        "type": "processlink-upload",
        "name": "Upload to Process Link",
        "server": "config-node-id",
        "filename": "",
        "timeout": "30000",
        "wires": [["debug-node"]]
    },
    {
        "id": "debug-node",
        "type": "debug",
        "name": "Result",
        "active": true,
        "tosidebar": true,
        "complete": "true",
        "wires": []
    }
]
```

### Upload with Custom Filename

Set the filename dynamically:

```javascript
// In a Function node before the upload:
msg.filename = "report-" + new Date().toISOString().split('T')[0] + ".csv";
return msg;
```

### Handle Upload Result

Check if upload succeeded:

```javascript
// In a Function node after the upload:
if (msg.statusCode === 201) {
    node.status({fill:"green", shape:"dot", text:"Success"});
    msg.payload = {
        success: true,
        fileId: msg.file_id,
        message: "File uploaded successfully"
    };
} else {
    node.status({fill:"red", shape:"dot", text:"Failed"});
    msg.payload = {
        success: false,
        error: msg.payload.error || "Upload failed",
        statusCode: msg.statusCode
    };
}
return msg;
```

## Error Handling

| Status Code | Meaning | Solution |
|-------------|---------|----------|
| 201 | Success | File uploaded successfully |
| 400 | Bad Request | Check that payload is a valid file buffer |
| 401 | Unauthorized | Check your API key is correct |
| 403 | Forbidden | Enable API access in site settings |
| 404 | Not Found | Check your Site ID is correct |
| 429 | Rate Limited | Slow down - max 30 uploads/minute per site |
| 507 | Storage Full | Contact your administrator to increase storage |

## Rate Limits

The API allows **30 uploads per minute** per site. If you exceed this limit, you'll receive a 429 status code. The node will still output the message so you can implement retry logic in your flow.

## Security

- API keys are stored encrypted by Node-RED
- All communication uses HTTPS
- Keys are never logged or exposed in flow exports

## Support

- **Issues**: [GitHub Issues](https://github.com/process-link/node-red-contrib-processlink-files/issues)
- **Process Link**: [files.processlink.com.au](https://files.processlink.com.au)

## License

MIT
