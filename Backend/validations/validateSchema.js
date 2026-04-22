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
    phoneNumber: joi.string().required().trim().min(10).max(13).messages({
      'string.required': 'telefon numarası alanı zorunludur ve 10 karakter olmalıdır başına 0 koymadan deneyiniz',
      'string.max': 'telefon numarası alanı en fazla 10 karakter içermelidir',
      'string.min': 'telefon numarası alanı en az 10 karakter içermelidir'
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
  })
}


module.exports = schemas;