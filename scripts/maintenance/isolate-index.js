// isolate-index.js
const fs = require('fs');
const path = require('path');

const VIEWS_DIR = path.join(__dirname, 'views');
const INDEX_EJS_PATH = path.join(VIEWS_DIR, 'index.ejs');

// --- Content that forces the server to compile successfully ---
const ISOLATED_INDEX_CONTENT = `
<%
/**
 * views/index.ejs - ISOLATED VERSION
 * All dynamic content is temporarily commented out to resolve SyntaxError.
 */
%>
<!DOCTYPE html>
<html>
<head>
    <title>ISOLATED TEST PAGE</title>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/materialize/1.0.0/css/materialize.min.css">
</head>
<body>

<%- include('layouts/header') %>

<main class="container">
    <div class="row">
        <div class="col s12 center-align">
            <h1>✅ ARCHITECTURE CHECKPOINT</h1>
            <p class="flow-text">If you see this page, the EJS compilation is successful. The previous error was in the dynamic content loop.</p>
            <%-- The original content loop is commented out below --%>

            <% /* if (data && data.contentBlocks && data.contentBlocks.length > 0) {
                data.contentBlocks.forEach(block => { 
                    // ... ALL 10 BLOCK TYPES LOGIC ...
                });
            } */ %>
        </div>
    </div>
</main>

<%- include('layouts/footer') %>

<script src="https://cdnjs.cloudflare.com/ajax/libs/materialize/1.0.0/js/materialize.min.js"></script>
</body>
</html>
`;

try {
    fs.writeFileSync(INDEX_EJS_PATH, ISOLATED_INDEX_CONTENT.trim());
    console.log(`\n✅ SUCCESS: views/index.ejs is now an isolated test page.`);
} catch (error) {
    console.error(`\n❌ ERROR: Failed to write views/index.ejs.`);
}
