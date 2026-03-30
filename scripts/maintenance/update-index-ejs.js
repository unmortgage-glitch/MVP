// update-index-ejs.js
const fs = require('fs');
const path = require('path');

const VIEWS_DIR = path.join(__dirname, 'views');
const INDEX_EJS_PATH = path.join(VIEWS_DIR, 'index.ejs');

// List of all content block types confirmed in the structure
const BLOCK_TYPES = [
    'image', 'text', 'quote', 'audio', 'video', 
    'list', 'form', 'cta', 'accordion', 'calculator'
];

// ----------------------------------------------------------------------
// The EJS content to write (using the clean paths: layouts/ and partials/)
// ----------------------------------------------------------------------
const NEW_INDEX_CONTENT = `
<%
/**
 * views/index.ejs - THE CANONICAL DYNAMIC PAGE TEMPLATE
 * * Abstractly renders content based on validated data.contentBlocks array.
 * Uses clean paths: layouts/ and partials/
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
                        <strong>ARCHITECTURAL WARNING:</strong> Unknown block type received in content data: **<%= block.type %>**. 
                        This should have been caught by ContentBlockSchema validation in Phase 4.
                    </span>
                </div>
            <% } %>
            <% // End of Dynamic Block Rendering Logic %>
        <% }); %>
    <% } else { %>
        <div class="center-align" style="margin-top: 5rem;">
            <i class="material-icons large grey-text text-lighten-1">layers_clear</i>
            <h4>No content blocks loaded. Check /content/live/homepage.json.</h4>
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
    console.log(`Rewriting views/index.ejs to enforce clean path standards...`);
    // Write the new content, completely overwriting the old file
    fs.writeFileSync(INDEX_EJS_PATH, NEW_INDEX_CONTENT.trim());
    console.log(`\n✅ SUCCESS: views/index.ejs has been completely overwritten.`);
    console.log(`All EJS include paths are now standardized to 'layouts/...' and 'partials/...'`);
} catch (error) {
    console.error(`\n❌ ERROR: Failed to write to views/index.ejs. Check file permissions.`);
    console.error(error.message);
}

// Final action needed reminder
console.log(`\n--- Next Step Reminder ---`);
console.log(`1. Ensure your server is restarted.`);
console.log(`2. The homepage should now load.`);
console.log(`3. We MUST now implement the AJV Content Schema validation (Phase 4) to prevent data corruption from breaking the page again.`);
