const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config({ path: '.env.local' });

async function test() {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
  try {
    const res = await model.generateContent("hello");
    console.log(res.response.text());
  } catch(e) {
    console.error("Error calling gemini-2.5-flash:");
    console.error(e.status, e.message);
  }
}
test();
