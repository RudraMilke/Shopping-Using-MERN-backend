import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "./models/User.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();
const app=express();
app.use(cors());
app.use(express.json());
const auth = (req, res, next) => {
  const authHeader = req.headers["authorization"]; // always lowercase in Node
  if (!authHeader) {
    return res.status(401).json({ error: "No token" });
  }

  const token = authHeader.split(" ")[1]; // "Bearer <token>"
  if (!token) {
    return res.status(401).json({ error: "Malformed token" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "secret_key");
    req.user = decoded; 
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid token" });
  }
};


mongoose.connect("mongodb://127.0.0.1:27017/shopdb" || process.env.MONGO_URI,{
    useNewUrlParser:true,
    useUnifiedTopology:true
}).then(()=>console.log("mongodb connected")).catch((err)=>console.log(err))

const productsSchema=new mongoose.Schema({
    name:String,
    price:Number,
    image:String
});
const Product = mongoose.model("Product", productsSchema);

app.get("/products",async(req,res)=>{
    const products=await Product.find();
    res.json(products);
});

app.get("/seed",async(req,res)=>{
  const fname = fileURLToPath(import.meta.url);
  const dirname = path.dirname(fname);
  const data = fs.readFileSync(path.join(dirname,"product.json"),"utf-8");
  const products = JSON.parse(data);
  await Product.deleteMany({});
  await Product.insertMany(products);
  res.send("Database seeded");

});

app.post("/signup", async (req,res) => {
    try {
        const {name,email,password} = req.body;
        const hashedTass = await bcrypt.hash(password,10);
        const user = new User({
            name, email, password : hashedTass
        });
        await user.save();
        res.json({
            message : "User registered"
        });
    } catch (err) {
        res.status(400).json({
            error : "User already exist"
        });
    }
});

app.post("/login", async (req,res) => {
    const {email,password} = req.body;
    const user = await User.findOne({email});
    if (!user) {
        return res.json(400).json({error : "user not found"});
    } 
    const vaild = await bcrypt.compare(password, user.password);
    if(!vaild){
        return res.json(400).json({error : "password not found"});
    }
    const token = jwt.sign({id : user._id}, process.env.JWT_SECRET || "Secret key", {expiresIn : "1h"});
    res.json({
        token, user : {name : user.name, email : user.email}
    });
});

app.get("/profile", auth, async (req,res) => {
    const user = await User.findById(req.user.id).select("-password");
    res.json(user);
})


app.listen(process.env.PORT || 5000, () => console.log("server is running"));
