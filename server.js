// =========================================================================
//                  COMPLETE, CORRECTED server.js FILE
// =========================================================================
require('dotenv').config();

const express = require('express');
const Stripe = require('stripe');
const cors = require('cors');

const app = express();
const port = process.env.PORT || 8080;

const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

// --- Middleware Configuration ---
// IMPORTANT: Middleware must be configured at the top, before any routes.

const corsOptions = {
    origin: [
        'https://realmstoriches.xyz',
        'https://my-stripe-backend-inky.vercel.app',
        'http://localhost:8080',
        'http://127.0.0.1:8080'
    ],
    methods: ['GET', 'POST'],
    credentials: true,
};

// Apply middleware
app.use(cors(corsOptions)); // Handles CORS pre-flight requests
app.use(express.json()); // Parses incoming JSON request bodies
app.use(express.urlencoded({ extended: true }));


// --- Route Definitions ---

// Basic health check route
app.get('/', (req, res) => {
    res.send('Stripe backend for Realms to Riches is running!');
});


// OLD ENDPOINT (kept for reference, but not used by new flow)
app.post('/create-payment-intent', async (req, res) => {
    const { items } = req.body;

    const calculateOrderAmount = (cartItems) => {
        let total = 0;
        if (!cartItems || cartItems.length === 0) return 0;
        cartItems.forEach(item => {
            const price = parseFloat(item.price);
            const quantity = parseInt(item.quantity, 10);
            if (!isNaN(price) && !isNaN(quantity)) {
                total += price * quantity;
            }
        });
        return Math.round(total * 100);
    };

    const amount = calculateOrderAmount(items);
    const currency = 'usd';

    if (amount <= 0) {
        return res.status(400).json({ error: 'Invalid cart data or cart is empty.' });
    }

    try {
        const paymentIntent = await stripe.paymentIntents.create({
            amount: amount,
            currency: currency,
            automatic_payment_methods: { enabled: true },
            description: 'Payment for Realms to Riches products/services',
            metadata: { integration_check: 'accept_a_payment' }
        });
        res.json({ clientSecret: paymentIntent.client_secret });
    } catch (error) {
        console.error('Stripe error creating PaymentIntent:', error);
        res.status(500).json({ error: 'Failed to create payment intent.' });
    }
});


// NEW, CORRECTED ENDPOINT FOR STRIPE HOSTED CHECKOUT
app.post('/create-checkout-session', async (req, res) => {
    try {
        const { items } = req.body;

        if (!items || items.length === 0) {
            return res.status(400).json({ error: 'Cannot create a session with no items.' });
        }

        const yourWebsiteURL = 'https://realmstoriches.xyz';

        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            mode: 'payment',
            line_items: items.map(item => {
                const unitAmount = Math.round(parseFloat(item.price) * 100);
                if (isNaN(unitAmount) || unitAmount <= 0) {
                    throw new Error(`Invalid price for item: ${item.name}`);
                }
                return {
                    price_data: {
                        currency: 'usd',
                        product_data: {
                            name: item.name,
                        },
                        unit_amount: unitAmount,
                    },
                    quantity: parseInt(item.quantity, 10),
                };
            }),
            success_url: `${yourWebsiteURL}/success.html?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${yourWebsiteURL}/cancel.html`,
            custom_domain: {
                domain: 'checkout.realmstoriches.xyz',
                enabled: true,
            },
        });

        res.json({ url: session.url });

    } catch (error) {
        console.error('Error creating Stripe Checkout session:', error.message);
        res.status(500).json({ error: `Internal Server Error: ${error.message}` });
    }
});


// --- Start the Server ---
// There should only be ONE app.listen call at the very end of the file.
app.listen(port, () => {
    console.log(`Backend server listening on port ${port}`);
});
