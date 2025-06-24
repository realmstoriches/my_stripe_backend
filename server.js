// server.js
require('dotenv').config(); // Loads environment variables from .env file for local development

const express = require('express');
const Stripe = require('stripe');
const cors = require('cors'); // CORS middleware

const app = express();
const port = process.env.PORT || 8080; // Use Render's PORT env var in production, or 3001 locally

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
        'https://mystripebackend-production.up.railway.app', // Your Render.com backend URL
        'http://localhost:8080',                    // Common for local development (e.g., if using live-server)
        'http://127.0.0.1:8080'                     // Another common local development address (e.g., VS Code Live Server)
    ],
    methods: ['GET', 'POST'], // Allow GET and POST requests
    credentials: true,       // Allow sending cookies (not strictly needed for Stripe API calls, but good practice)
};
app.use(cors(corsOptions));

// Basic health check endpoint - Render.com uses this to know your service is alive
app.get('/', (req, res) => {
    res.send('Stripe backend for Realms to Riches is running!');
});

// CORRECTED ENDPOINT TO CREATE A STRIPE PAYMENT INTENT
app.post('/create-payment-intent', async (req, res) => {
    // Get the 'items' array from the request body sent by the frontend
    const { items } = req.body;

    // --- SERVER-SIDE PRICE CALCULATION (VERY IMPORTANT & SECURE) ---
    const calculateOrderAmount = (cartItems) => {
        let total = 0;
        if (!cartItems || cartItems.length === 0) {
            return 0;
        }
        cartItems.forEach(item => {
            // Ensure price and quantity are valid numbers
            const price = parseFloat(item.price);
            const quantity = parseInt(item.quantity, 10);
            if (!isNaN(price) && !isNaN(quantity)) {
                total += price * quantity;
            }
        });
        // Stripe requires the amount in the smallest currency unit (e.g., cents for USD)
        // We use Math.round to avoid any floating-point inaccuracies.
        return Math.round(total * 100);
    };

    const amount = calculateOrderAmount(items);
    const currency = 'usd'; // Set your currency here

    // Basic validation on the calculated amount
    if (amount <= 0) {
        return res.status(400).json({ error: 'Invalid cart data or cart is empty, resulting in a zero or negative total.' });
    }

    try {
        const paymentIntent = await stripe.paymentIntents.create({
            amount: amount,
            currency: currency,
            automatic_payment_methods: { enabled: true },
            description: 'Payment for Realms to Riches products/services',
            metadata: { integration_check: 'accept_a_payment' }
        });

        // Send the client_secret back to the frontend
        res.json({ clientSecret: paymentIntent.client_secret });
    } catch (error) {
        console.error('Stripe error creating PaymentIntent:', error);
        res.status(500).json({ error: 'Failed to create payment intent. Please try again.' });
    }
});


// Start the server
app.listen(port, () => {
    console.log(`Backend server listening on port ${port}`);
});
