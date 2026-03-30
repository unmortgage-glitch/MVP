const express = require('express');
const path = require('path');
const container = require('./src/container');

const app = express();
const PORT = process.env.PORT || 3000;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// Public Landing
app.get('/', (req, res) => res.render('index', { title: 'Welcome' }));

// Secure Admin Area
app.use('/admin', container.security, container.adminRouter);

app.listen(PORT, () => {
    console.log(`KENWARD MORTGAGE CRM: ONLINE [Port ${PORT}]`);
});
