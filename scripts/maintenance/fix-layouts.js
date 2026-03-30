// fix-layouts.js (Syntactically Verified Final Version)
const fs = require('fs');
const path = require('path');

const LAYOUTS_DIR = path.join(__dirname, 'views', 'layouts');

console.log('--- Starting Layout Syntax Verification ---');

const layouts = [
    {
        name: 'header.ejs',
        content: `
<%
/**
 * views/layouts/header.ejs
 * Standard application header and navigation (MaterializeCSS)
 * Input: { pageTitle }
 */
%>
<nav class="teal darken-1" role="navigation">
    <div class="nav-wrapper container">
        <a id="logo-container" href="/" class="brand-logo white-text">Kenward Mortgage</a>
        <ul class="right hide-on-med-and-down">
            <li><a href="/homepage">Home</a></li>
            <li><a href="/admin/new">Admin</a></li>
        </ul>
        <ul id="nav-mobile" class="sidenav">
            <li><a href="/homepage">Home</a></li>
            <li><a href="/admin/new">Admin</a></li>
        </ul>
        <a href="#" data-target="nav-mobile" class="sidenav-trigger"><i class="material-icons">menu</i></a>
    </div>
</nav>
`
    },
    {
        name: 'footer.ejs',
        content: `
<%
/**
 * views/layouts/footer.ejs
 * Standard application footer (MaterializeCSS)
 */
%>
<footer class="page-footer teal darken-1">
    <div class="container">
        <div class="row">
            <div class="col l6 s12">
                <h5 class="white-text">Contact Us</h5>
                <p class="grey-text text-lighten-4">Licensed Mortgage Broker in BC. Member of CMBABC.</p>
            </div>
            <div class="col l4 offset-l2 s12">
                <h5 class="white-text">Links</h5>
                <ul>
                    <li><a class="grey-text text-lighten-3" href="mailto:peter@kenward.ca">Email</a></li>
                    <li><a class="grey-text text-lighten-3" href="tel:2509188169">Call (250 918 8169)</a></li>
                </ul>
            </div>
        </div>
    </div>
    <div class="footer-copyright">
        <div class="container">
            © 2025 Kenward Mortgage Broker Inc. | Our slogan: "Be secure. Be well. Thrive"
        </div>
    </div>
</footer>
<script>
    // Initialize Materialize Sidenav for mobile navigation
    document.addEventListener('DOMContentLoaded', function() {
        var elems = document.querySelectorAll('.sidenav');
        M.Sidenav.init(elems, {});
    });
</script>
`
    }
];

// Ensure the layouts directory exists
if (!fs.existsSync(LAYOUTS_DIR)) {
    fs.mkdirSync(LAYOUTS_DIR, { recursive: true });
}

layouts.forEach(layout => {
    try {
        const filePath = path.join(LAYOUTS_DIR, layout.name);
        fs.writeFileSync(filePath, layout.content.trim());
        // FIX: Using standard string concatenation to prevent SyntaxError
        console.log('✅ Overwritten: ' + layout.name); 
    } catch (error) {
        console.error('❌ ERROR writing ' + layout.name + ': ' + error.message);
    }
});

console.log('\n--- Layouts Verified. Restart Server ---');
