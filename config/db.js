// import mongoose from 'mongoose'
// const connectDB = async () => {
// try {
//     await mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });
//     console.log('MongoDB connected');
// } catch (err) {
//     console.error('MongoDB connection error:', err.message);
//     process.exit(1);
// }
// };

// export default connectDB;


import mongoose from 'mongoose';

const connectDB = async () => {
try {
    const conn = await mongoose.connect(process.env.MONGO_URI);
    
    console.log(` MongoDB connected: ${conn.connection.host}`);
} catch (error) {
    console.error(` MongoDB connection error: ${error.message}`);
    process.exit(1);
}
};

export default connectDB;