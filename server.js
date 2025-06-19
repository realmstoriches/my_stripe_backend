// server.js
require('dotenv').config(); // Loads environment variables from .env file for local development

const express = require('express');
const Stripe = require('stripe');
const cors = require('cors'); // CORS middleware

const app = express();
const port = process.env.PORT || 3001; // Use Render's PORT env var in production, or 3001 locally

// Initialize Stripe with your **SECRET KEY**.
// This key will be pulled from Render's environment variables in production.
// For local testing, ensure you have a .env file with STRIPE_SECRET_KEY.
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

// Middleware
app.use(express.json()); // Essential: Parses incoming JSON request bodies
app.use(express.urlencoded({ extended: true })); // Parses URL-encoded data

// Configure CORS to allow requests from your GitHub Pages frontend and your backend itself
const corsOptions = {
    origin: [
        'https://realmstoriches.xyz',         // Your GitHub Pages frontend URL
        'https://my-stripe-backend-api.onrender.com', // Your Render.com backend URL
        'http://localhost:8080',                    // Common for local development (e.g., if using live-server)
        'http://127.0.0.1:5500'                     // Another common local development address (e.g., VS Code Live Server)
    ],
    methods: ['GET', 'POST'], // Allow GET and POST requests
    credentials: true,       // Allow sending cookies (not strictly needed for Stripe API calls, but good practice)
};
app.use(cors(corsOptions));

// Basic health check endpoint - Render.com uses this to know your service is alive
app.get('/', (req, res) => {
    res.send('Stripe backend for Realms to Riches is running!');
});

// Endpoint to create a Stripe PaymentIntent
// The frontend will call this to get a client_secret for Stripe Elements
app.post('/create-payment-intent', async (req, res) => {
    // 'amount' should be in the smallest currency unit (e.g., 10000 for $100.00 USD)
    const { amount, currency } = req.body;

    // Basic validation
    if (!amount || typeof amount !== 'number' || amount <= 0 || !currency) {
        return res.status(400).json({ error: 'Valid amount (number > 0) and currency are required.' });
    }

    try {
        const paymentIntent = await stripe.paymentIntents.create({
            amount: amount,
            currency: currency,
            automatic_payment_methods: { enabled: true }, // Enable various payment methods supported by Stripe
            description: 'Payment for custom website service/product', // Add a relevant description
            // You can add more metadata here from your frontend if needed, e.g., order ID, customer email
            metadata: { integration_check: 'accept_a_payment' }
        });

        // Send the client_secret back to the frontend
        res.json({ clientSecret: paymentIntent.client_secret });
    } catch (error) {
        console.error('Stripe error creating PaymentIntent:', error);
        // Provide a more generic error message to the client for security
        res.status(500).json({ error: 'Failed to create payment intent. Please try again.' });
    }
});

// Start the server and listen for incoming requests
app.listen(port, () => {
    console.log(`Backend server listening at http://localhost:${port}`);
});
