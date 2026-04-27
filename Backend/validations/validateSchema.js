const joi = require('joi');

const schemas = {
  register: joi.object({
    name: joi.string().required().trim().min(3).max(100).messages({
      'string.required': 'isim alanı gereklidir.',
      'string.max': 'isim alanı en fazla 100 karakter içermelidir',
      'string.min': 'isim alanı en az 3 karakter içermelidir'
    }),
    email: joi.string().email().trim().required().min(3).max(100).required().messages({
      'string.base': 'email alanı metin olmalıdır.',
      'string.empty': 'email boş bırakılamaz.',
      'string.max': 'email alanı en fazla 100 karakter içermelidir.',
      'string.required': 'email alanı zorunludur'
    }),
    password: joi.string().required().trim().min(6).max(20).messages({
      'string.required': 'şifre alanı zorunludur.',
      'string.min': 'şifre alanı en az 6 karakter içermelidir',
      'string.max': 'şifre alanı en fazla 20 karakter içermelidir.'
    }),
    phoneNumber: joi.string().length(10).pattern(/^[0-9]+$/).required().messages({
      'string.length': 'telefon numarası 10 haneli olmalıdır',
      'string.pattern.base': 'telefon numarası sadece rakamlardan oluşmalıdır',
      'string.required': 'telefon numarası zorunludur'
    }),
    city: joi.string().required().messages({
      'string.required': 'şehir alanı zorunludur'
    }),
    district: joi.string().required().messages({
      'string.required': 'ilçe alanı zorunludur'
    }),
    role: joi.string().valid('USER', 'EMPLOYEE').default('USER'),
    employeeType: joi.string().valid('TRASH_COLLECTOR', 'WASTE_COLLECTOR').allow('', null).empty('').default(null).optional()
  }),
  login: joi.object({
    email: joi.string().email().trim().required().min(3).max(100).required().messages({
      'string.base': 'email alanı metin olmalıdır',
      'string.required': 'email alanı zorunludur'
    }),
    password: joi.string().required().trim().min(6).max(20).messages({
      'string.required': 'şifre alanı zorunludur'
    })
  }),
  resetPassMail: joi.object({
    email: joi.string().email().trim().required().min(3).max(100).required().messages({
      'string.base': 'email alanı metin olmalıdır',
      'string.required': 'email alanı zorunludur'
    }),
  }),
  resetPassword: joi.object({
    password: joi.string().required().trim().min(6).max(20).messages({
      'string.required': 'şifre alanı zorunludur'
    })
  })
}


module.exports = schemas;