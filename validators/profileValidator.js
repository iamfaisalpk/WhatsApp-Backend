import Joi from 'joi';

export const profileUpdateSchema = Joi.object({
    name: Joi.string().min(3).max(30).required().messages({
    'string.empty': 'Name is required',
    'string.min': 'Name should have at least 3 characters',
    'string.max': 'Name should not exceed 30 characters',
}),
});
