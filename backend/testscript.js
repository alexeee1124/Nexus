const mongoose = require('mongoose');
const Source = require('./models/Source');
const axios = require('axios');

async function run() {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb+srv://alexee:H7Kz7X5d6Vw8@cluster0.pud4d.mongodb.net/nexus?retryWrites=true&w=majority');
    const src = await Source.findOne({});
    const res = await axios.get(src.base + '/messages/bb479f47c78e0427.json?orderBy="$key"&limitToLast=5');
    console.log(JSON.stringify(res.data, null, 2));
    process.exit(0);
}
run();
