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
  }),

  binCreate: joi
    .object({
      latitude: joi.number().min(-90).max(90).required(),
      longitude: joi.number().min(-180).max(180).required(),
      wasteCategory: joi
        .string()
        .valid('DOMESTIC', 'ELECTRONIC', 'PLASTIC', 'GLASS', 'PAPER', 'GENERAL')
        .required(),
      type: joi.string().valid('CONTAINER_LARGE', 'CONTAINER_SMALL', 'WASTE_POINT').required(),
      capacityVolume: joi.number().positive().required(),
      regionId: joi.string().trim().required().messages({
        'string.empty': 'Parsel / bölge bilgisi zorunludur.',
      }),
    })
    .unknown(false),

  binUpdate: joi
    .object({
      latitude: joi.number().min(-90).max(90).optional(),
      longitude: joi.number().min(-180).max(180).optional(),
      wasteCategory: joi
        .string()
        .valid('DOMESTIC', 'ELECTRONIC', 'PLASTIC', 'GLASS', 'PAPER', 'GENERAL')
        .optional(),
      type: joi.string().valid('CONTAINER_LARGE', 'CONTAINER_SMALL', 'WASTE_POINT').optional(),
      capacityVolume: joi.number().positive().optional(),
      regionId: joi.string().trim().allow('', null).optional(),
    })
    .min(1)
    .messages({
      'object.min': 'En az bir alan gönderilmelidir.',
    })
    .unknown(false),

  collectBin: joi.object({}).unknown(false),

  workRegionUpdate: joi
    .object({
      regionId: joi.string().uuid().required().messages({
        'string.empty': 'Çalışma bölgesi seçilmelidir.',
        'string.guid': 'Geçersiz bölge seçimi.',
      }),
    })
    .unknown(false),

  wasteRequestCreate: joi
    .object({
      wasteType: joi
        .string()
        .valid('DOMESTIC', 'ELECTRONIC', 'PLASTIC', 'GLASS', 'PAPER', 'GENERAL')
        .required(),
      latitude: joi.number().min(-90).max(90).required(),
      longitude: joi.number().min(-180).max(180).required(),
      note: joi.string().trim().max(500).allow('', null).optional(),
    })
    .unknown(false),

  wasteRequestUpdate: joi
    .object({
      status: joi
        .string()
        .valid('PENDING', 'ON_ROUTE', 'COLLECTED', 'CANCELLED')
        .optional(),
      assignedEmployeeId: joi.string().uuid().allow(null).optional(),
    })
    .min(1)
    .messages({
      'object.min': 'En az bir alan gönderilmelidir.',
    })
    .unknown(false),
};


module.exports = schemas;