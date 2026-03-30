// fix-partials.js
const fs = require('fs');
const path = require('path');

const PARTIALS_DIR = path.join(__dirname, 'views', 'partials');

console.log('--- Starting Partial Syntax Verification ---');

const partials = [
    {
        name: '_imageBlock.ejs',
        content: `
<%
const { imageUrl, altText, caption } = block;
%>
<section class="container section">
    <div class="row">
        <div class="col s12 center-align">
            <img class="responsive-img z-depth-1"
                 src="<%- imageUrl %>" 
                 alt="<%- altText %>" 
                 style="max-height: 400px; width: auto; display: block; margin: 0 auto;">

            <% if (caption) { %>
            <p class="caption grey-text"><%- caption %></p>
            <% } %>
        </div>
    </div>
</section>
`
    },
    {
        name: '_textBlock.ejs',
        content: `
<%
const { body, className = '' } = block;
%>
<div class="row">
    <div class="col s12 <%= className %>">
        <%- body %> 
    </div>
</div>
`
    },
    {
        name: '_quoteBlock.ejs',
        content: `
<%
const { quoteText, source } = block;
%>
<div class="row">
    <div class="col s12">
        <blockquote class="flow-text">
            <p>"<%= quoteText %>"</p>
            <footer>— <%= source %></footer>
        </blockquote>
    </div>
</div>
`
    }
];

partials.forEach(partial => {
    try {
        const filePath = path.join(PARTIALS_DIR, partial.name);
        fs.writeFileSync(filePath, partial.content.trim());
        console.log(`✅ Overwritten: ${partial.name}`);
    } catch (error) {
        console.error(`❌ ERROR writing ${partial.name}: ${error.message}`);
    }
});

console.log('\n--- Partials Verified. Restart Server ---');
