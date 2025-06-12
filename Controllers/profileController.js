import User from '../Models/User.js';


export const getMyProfile = async (req, res) => {
try {
    const user = await User.findById(req.user.id).select('-__v -otp');
    if (!user) {
        return res.status(404).json({ success: false, message: 'User not found' });
    }

    res.status(200).json({
        success: true,
        user,
    });
} catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
}
};


export const updateMyProfile = async (req, res) => {
try {
    const userId = req.user?.id;
    if (!userId) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const { name } = req.body;
    const profilePic = req.file?.path;

    if (!name && !profilePic) {
        return res.status(400).json({ success: false, message: 'No fields to update' });
    }

    const updatedData = {};
    if (name?.trim()) updatedData.name = name.trim();
    if (profilePic) updatedData.profilePic = profilePic;

    const updatedUser = await User.findByIdAndUpdate(userId, updatedData, {
        new: true,
        select: '-otp -__v'
    });

    if (!updatedUser) {
        return res.status(404).json({ success: false, message: 'User not found' });
    }

    res.status(200).json({
        success: true,
        message: 'Profile updated successfully',
        user: updatedUser,
    });
} catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({
        success: false,
        message: 'Something went wrong',
        error: error.message,
    });
}
};
