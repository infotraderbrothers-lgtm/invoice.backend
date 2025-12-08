const express = require('express');
const cors = require('cors');
const stripe = require('stripe')('sk_test_51ScASNK7DEVkPpUa6yyNhtIXZx20qUQYu12kwxT3uSeCd4Zbq2680s0YuETOdpcJfV1R0T8R7SIZMuTmVCCpH6Ru00tBt2BmzX');

const app = express();

// Middleware
app.use(cors()); // Allow requests from any origin
app.use(express.json());

// Health check endpoint
app.get('/', (req, res) => {
  res.json({ 
    status: 'Server is running',
    message: 'Trader Brothers Payment Backend',
    timestamp: new Date().toISOString()
  });
});

// Create payment intent endpoint
app.post('/create-payment-intent', async (req, res) => {
  try {
    const { amount, currency, invoiceNumber, customerEmail, customerName } = req.body;

    // Validate required fields
    if (!amount || !currency) {
      return res.status(400).json({ error: 'Amount and currency are required' });
    }

    // Create a PaymentIntent with the order amount and currency
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amount, // Amount in smallest currency unit (pence for GBP)
      currency: currency,
      metadata: {
        invoiceNumber: invoiceNumber || 'N/A',
        customerName: customerName || 'N/A',
      },
      receipt_email: customerEmail || undefined,
      automatic_payment_methods: {
        enabled: true,
      },
    });

    // Log successful creation
    console.log(`✅ Payment Intent created: ${paymentIntent.id} for ${customerName} - ${invoiceNumber}`);

    // Send back the client secret
    res.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id
    });
  } catch (error) {
    console.error('❌ Error creating payment intent:', error);
    res.status(500).json({ 
      error: error.message || 'Failed to create payment intent' 
    });
  }
});

// Webhook endpoint for Stripe events (optional but recommended for production)
app.post('/webhook', express.raw({ type: 'application/json' }), (req, res) => {
  const sig = req.headers['stripe-signature'];
  
  // You'll need to set this in your Render environment variables
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.log('⚠️  Webhook secret not configured');
    return res.sendStatus(400);
  }

  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err) {
    console.log(`⚠️  Webhook signature verification failed:`, err.message);
    return res.sendStatus(400);
  }

  // Handle the event
  switch (event.type) {
    case 'payment_intent.succeeded':
      const paymentIntent = event.data.object;
      console.log(`✅ Payment succeeded: ${paymentIntent.id}`);
      // Here you could update your database, send confirmation emails, etc.
      break;
    case 'payment_intent.payment_failed':
      const failedPayment = event.data.object;
      console.log(`❌ Payment failed: ${failedPayment.id}`);
      break;
    default:
      console.log(`Unhandled event type ${event.type}`);
  }

  res.json({ received: true });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`
========================================
🚀 Trader Brothers Payment Server
========================================
Server running on port ${PORT}
Environment: ${process.env.NODE_ENV || 'development'}
Stripe: Configured ✓
CORS: Enabled ✓
========================================
  `);
});
