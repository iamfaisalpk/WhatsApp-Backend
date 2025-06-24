import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
    phone: { 
        type: String, 
        required: [true, 'Phone number is required'],
        unique: true, 
        trim: true
    },
    otp: {
        type: String,
        default: null,
        select: false
    },
    otpExpiry: {
        type: Date,
        default: null,
        select: false
    },
    name: { 
        type: String, 
        default: null, 
        trim: true,
        minlength: [2, 'Name must be at least 2 characters long'],
        maxlength: [50, 'Name cannot exceed 50 characters']
    },
    about: { 
        type: String, 
        default: 'Hey there! I am using WhatsApp Clone.',
        trim: true,
        maxlength: [200, 'About cannot exceed 200 characters']
    },
    profilePic: { 
        type: String, 
        default: null
    },
    isVerified: { 
        type: Boolean, 
        default: false 
    },
    lastLogin: { 
        type: Date, 
        default: null 
    },
    isOnline: { 
        type: Boolean, 
        default: false 
    },
    lastSeen: { 
        type: Date, 
        default: null 
    },
    isActive: {
        type: Boolean,
        default: true  
    }
}, { 
    timestamps: true,
    toJSON: {
        transform: function(doc, ret) {
            delete ret.otp;
            delete ret.otpExpiry;
            delete ret.__v;
            
            if (ret.name === '') ret.name = null;
            if (ret.profilePic === '') ret.profilePic = null;
            
            return ret;
        }
    }
});



// Only add additional indexes
userSchema.index({ isVerified: 1, isActive: 1 });
userSchema.index({ isOnline: 1 });
userSchema.index({ lastSeen: -1 });

// Static method to find by phone
userSchema.statics.findByPhone = function(phone) {
    return this.findOne({ phone: phone.trim() });
};

// Instance method for safe object
userSchema.methods.toSafeObject = function() {
    const userObject = this.toObject();
    delete userObject.otp;
    delete userObject.otpExpiry;
    delete userObject.__v;
    return userObject;
};

const User = mongoose.model('User', userSchema, 'users');

export default User;