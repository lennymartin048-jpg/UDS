import { verifyKey } from 'discord-interactions';
import webpush from 'web-push';

globalThis.ordersStore = globalThis.ordersStore || [];

const CATALOG = {
  "glock 17 roblox": { name: "Glock 17 Roblox", price: 5000 },
  "glock 18 roblox": { name: "Glock 18 Roblox", price: 8000 },
  "glock 19 roblox": { name: "Glock 19 Roblox", price: 10000 }
};

if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    'mailto:admin@example.com',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
}

export async function handler(event) {
  if (event.httpMethod === 'GET') {
    const params = new URLSearchParams(event.queryStringParameters);
    if (params.get('action') === 'get-orders') {
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(globalThis.ordersStore)
      };
    }
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch (err) {
    return { statusCode: 400, body: 'Invalid JSON' };
  }

  if (body.action === 'update-status') {
    const { orderId, newStatus } = body;
    const order = globalThis.ordersStore.find(o => o.id === orderId);
    
    if (order) {
      order.status = newStatus;

      if (order.interactionToken) {
        const webhookUrl = `https://discord.com/api/v10/webhooks/${process.env.DISCORD_APP_ID}/${order.interactionToken}`;
        
        await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content: `<@${order.userId}> 🚀 **Shipment Status Updated!**`,
            embeds: [{
              title: `Order Update: #${order.id}`,
              description: `Your order for **${order.item}** has advanced to stage: **${newStatus}**`,
              color: newStatus === 'Delivered' ? 65280 : 16753920
            }]
          })
        });
      }
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true })
    };
  }

  const signature = event.headers['x-signature-ed25519'];
  const timestamp = event.headers['x-signature-timestamp'];
  const isValid = verifyKey(event.body, signature, timestamp, process.env.DISCORD_PUBLIC_KEY);

  if (!isValid) {
    return { statusCode: 401, body: 'Invalid request signature' };
  }

  if (body.type === 1) {
    return { statusCode: 200, body: JSON.stringify({ type: 1 }) };
  }

  if (body.type === 2) {
    const selectedItem = body.data.options?.[0]?.value?.toLowerCase();
    const product = CATALOG[selectedItem];

    if (!product) {
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 4,
          data: { content: "Invalid item! Select Glock 17 Roblox, Glock 18 Roblox, or Glock 19 Roblox." }
        })
      };
    }

    const orderId = Math.floor(100000 + Math.random() * 900000).toString();
    const user = body.member?.user?.username || "Unknown Customer";
    const userId = body.member?.user?.id;

    const newOrder = {
      id: orderId,
      customer: user,
      userId: userId,
      item: product.name,
      price: product.price,
      status: "Processing",
      interactionToken: body.token
    };

    globalThis.ordersStore.push(newOrder);

    if (process.env.MY_IPHONE_SUBSCRIPTION_JSON) {
      try {
        const sub = JSON.parse(process.env.MY_IPHONE_SUBSCRIPTION_JSON);
        await webpush.sendNotification(sub, JSON.stringify({
          title: "🛒 New Roblox Order Received!",
          body: `${user} ordered ${product.name} (R$ ${product.price})`
        }));
      } catch (err) {
        console.error("iPhone Push failed:", err);
      }
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 4,
        data: {
          embeds: [{
            title: "✅ Order Successfully Confirmed",
            description: `Thank you for your purchase, **${user}**!`,
            fields: [
              { name: "Order ID", value: `#${orderId}`, inline: true },
              { name: "Item", value: product.name, inline: true },
              { name: "Price", value: `R$ ${product.price.toLocaleString()}`, inline: true },
              { name: "Shipment Status", value: "🟡 Processing", inline: false }
            ],
            color: 5763719
          }]
        }
      })
    };
  }
}