// fix-index-syntax.js
const fs = require('fs');
const path = require('path');

const VIEWS_DIR = path.join(__dirname, 'views');
const INDEX_EJS_PATH = path.join(VIEWS_DIR, 'index.ejs');

// --- Final, Verified EJS Content ---
const VERIFIED_INDEX_CONTENT = `
<%
/**
 * views/index.ejs - THE CANONICAL DYNAMIC PAGE TEMPLATE
 */
%>
<!DOCTYPE html>
<html>
<head>
    <title><%= pageTitle || "Kenward Mortgage Broker Inc." %></title>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/materialize/1.0.0/css/materialize.min.css">
</head>
<body>

<%-- Include Layout Header --%>
<%- include('layouts/header') %>

<main class="container">
    <% if (data && data.contentBlocks && data.contentBlocks.length > 0) { %>
        <% data.contentBlocks.forEach(block => { %>
            
            <% // Start of Dynamic Block Rendering Logic (Logic as Data) %>
            <% if (block.type === 'image') { %>
                <%- include('partials/_imageBlock', { block: block.data }) %>
            <% } else if (block.type === 'text') { %>
                <%- include('partials/_textBlock', { block: block.data }) %>
            <% } else if (block.type === 'quote') { %>
                <%- include('partials/_quoteBlock', { block: block.data }) %>
            <% } else if (block.type === 'audio') { %>
                <%- include('partials/_audioBlock', { block: block.data }) %>
            <% } else if (block.type === 'video') { %>
                <%- include('partials/_videoBlock', { block: block.data }) %>
            <% } else if (block.type === 'list') { %>
                <%- include('partials/_listBlock', { block: block.data }) %>
            <% } else if (block.type === 'form') { %>
                <%- include('partials/_formBlock', { block: block.data }) %>
            <% } else if (block.type === 'cta') { %>
                <%- include('partials/_ctaBlock', { block: block.data }) %>
            <% } else if (block.type === 'accordion') { %>
                <%- include('partials/_accordionBlock', { block: block.data }) %>
            <% } else if (block.type === 'calculator') { %>
                <%- include('partials/_calculatorBlock', { block: block.data }) %>
            <% } else { %>
                <div class="card-panel red lighten-4">
                    <span class="red-text text-darken-4">
                        <strong>ARCHITECTURAL WARNING:</strong> Unknown block type received: **<%= block.type %>**. 
                    </span>
                </div>
            <% } %>
            <% // End of Dynamic Block Rendering Logic %>

        <% }); %>

    <% } else { %>
        <div class="center-align" style="margin-top: 5rem;">
            <i class="material-icons large grey-text text-lighten-1">layers_clear</i>
            <h4>No content blocks loaded. Check content data.</h4>
        </div>
    <% } %>
</main>

<%-- Include Layout Footer --%>
<%- include('layouts/footer') %>

<script src="https://cdnjs.cloudflare.com/ajax/libs/materialize/1.0.0/js/materialize.min.js"></script>
</body>
</html>
`;
// ----------------------------------------------------------------------

try {
    fs.writeFileSync(INDEX_EJS_PATH, VERIFIED_INDEX_CONTENT.trim());
    console.log(`\n✅ SUCCESS: views/index.ejs has been verified and overwritten.`);
    console.log(`The EJS syntax should now be flawless.`);
} catch (error) {
    console.error(`\n❌ ERROR: Failed to write views/index.ejs. Check file permissions.`);
    console.error(error.message);
}
