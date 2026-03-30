const express = require('express');

// -- PURE TRANSFORMERS --
const formatClientForView = client => {
    // Visual Logic Computed Here
    const isRisk = (client.creditScore < 650); 
    return {
        id: client.id,
        name: client.name.toUpperCase(),
        creditScore: client.creditScore,
        loanAmount: client.loanAmount.toLocaleString(),
        cardClass: isRisk ? 'red lighten-1' : 'blue-grey darken-1',
        icon: isRisk ? 'priority_high' : 'face',
        hasErrors: isRisk,
        isApproved: !isRisk,
        progress: isRisk ? 20 : 80
    };
};

const prepareDashboardData = clients => ({
    clientCount: clients.length,
    clients: clients.map(formatClientForView)
});

// -- HANDLERS --
const getDashboard = services => (req, res, next) => {
    services.crmService.getAllClients()
        .then(clients => prepareDashboardData(clients))
        .then(viewData => res.render('admin/dashboard', { 
            title: 'Pipeline Control',
            ...viewData 
        }))
        .catch(next);
};

const createAdminRoutes = services => {
    const router = express.Router();
    router.get('/', getDashboard(services));
    return router;
};

module.exports = createAdminRoutes;
