<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title><%- data.header.brandName %></title>
    <link href="https://fonts.googleapis.com/icon?family=Material+Icons" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/materialize/1.0.0/css/materialize.min.css">
    <link rel="stylesheet" href="/css/style.css">
</head>
<body>
    <%- include('partials/header', { header: data.header }) %>
    <main>
        <% data.contentBlocks.forEach(block => { %>
            <% if (block.type === 'hero') { %>
                <%- include('partials/hero', { hero: block.data }) %>
            <% } else if (block.type === 'landAcknowledgement') { %>
                <%- include('partials/land-acknowledgement', { landAcknowledgement: block.data }) %>
            <% } else if (block.type === 'text') { %>
                <%- include('partials/blocks/_textBlock', { block: block.data }) %>
            <% } else if (block.type === 'image') { %>
                <%- include('partials/blocks/_imageBlock', { block: block.data }) %>
            <% } else if (block.type === 'video') { %>
                <%- include('partials/blocks/_videoBlock', { block: block.data }) %>
            <% } else if (block.type === 'quote') { %>
                <%- include('partials/blocks/_quoteBlock', { block: block.data }) %>
            <% } else if (block.type === 'list') { %>
                <%- include('partials/blocks/_listBlock', { block: block.data }) %>
            <% } else if (block.type === 'cta') { %>
                <%- include('partials/blocks/_ctaBlock', { block: block.data }) %>
            <% } else if (block.type === 'accordion') { %>
                <%- include('partials/blocks/_accordionBlock', { block: block.data }) %>
            <% } %>
        <% }); %>
    </main>
    <%- include('partials/footer', { footer: data.footer }) %>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/materialize/1.0.0/js/materialize.min.js"></script>
    <script>
      document.addEventListener('DOMContentLoaded', function() {
        var elems = document.querySelectorAll('.collapsible');
        M.Collapsible.init(elems);
      });
    </script>
</body>
</html>
