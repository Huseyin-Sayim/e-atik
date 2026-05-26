const joi = require('joi');

const schemas = {
  register: joi.object({
    name: joi.string().required().trim().min(2).max(100).messages({
      'string.empty': 'İsim alanı boş bırakılamaz.',
      'string.required': 'İsim alanı zorunludur.',
      'string.max': 'İsim alanı en fazla 100 karakter olabilir.',
      'string.min': 'İsim alanı en az 2 karakter olmalıdır.'
    }),
    surname: joi.string().required().trim().min(2).max(100).messages({
      'string.empty': 'Soyad alanı boş bırakılamaz.',
      'string.required': 'Soyad alanı zorunludur.',
      'string.max': 'Soyad alanı en fazla 100 karakter olabilir.',
      'string.min': 'Soyad alanı en az 2 karakter olmalıdır.'
    }),
    email: joi.string().email().trim().required().min(3).max(100).messages({
      'string.email': 'Lütfen geçerli bir e-posta adresi giriniz.',
      'string.empty': 'E-posta alanı boş bırakılamaz.',
      'string.required': 'E-posta alanı zorunludur.'
    }),
    password: joi.string().required().trim().min(6).max(20).messages({
      'string.empty': 'Şifre alanı boş bırakılamaz.',
      'string.required': 'Şifre alanı zorunludur.',
      'string.min': 'Şifre alanı en az 6 karakter olmalıdır.',
      'string.max': 'Şifre alanı en fazla 20 karakter olabilir.'
    }),
    phoneNumber: joi.string().required().trim().min(10).max(13).messages({
      'string.required': 'Telefon numarası zorunludur.',
      'string.min': 'Telefon numarası en az 10 karakter olmalıdır.',
      'string.max': 'Telefon numarası en fazla 13 karakter olabilir.'
    }),
    city: joi.string().required().trim().messages({
      'string.empty': 'Şehir alanı boş bırakılamaz.',
      'string.required': 'Şehir alanı zorunludur.'
    }),
    district: joi.string().required().trim().messages({
      'string.empty': 'İlçe alanı boş bırakılamaz.',
      'string.required': 'İlçe alanı zorunludur.'
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
      name: joi.string().trim().allow('', null).optional(),
      latitude: joi.number().min(-90).max(90).required(),
      longitude: joi.number().min(-180).max(180).required(),
      wasteCategory: joi
        .string()
        .valid('DOMESTIC', 'ELECTRONIC', 'PLASTIC', 'GLASS', 'PAPER', 'GENERAL')
        .required(),
      type: joi.string().valid('CONTAINER_LARGE', 'CONTAINER_SMALL', 'WASTE_POINT').required(),
      capacityVolume: joi.number().positive().required(),
      predictedFullness: joi.number().min(0).max(100).optional(),
      regionId: joi.string().trim().required().messages({
        'string.empty': 'Parsel / bölge bilgisi zorunludur.',
      }),
    })
    .unknown(false),

  binUpdate: joi
    .object({
      name: joi.string().trim().allow('', null).optional(),
      latitude: joi.number().min(-90).max(90).optional(),
      longitude: joi.number().min(-180).max(180).optional(),
      wasteCategory: joi
        .string()
        .valid('DOMESTIC', 'ELECTRONIC', 'PLASTIC', 'GLASS', 'PAPER', 'GENERAL')
        .optional(),
      type: joi.string().valid('CONTAINER_LARGE', 'CONTAINER_SMALL', 'WASTE_POINT').optional(),
      capacityVolume: joi.number().positive().optional(),
      predictedFullness: joi.number().min(0).optional(),
      regionId: joi.string().trim().allow('', null).optional(),
    })
    .min(1)
    .messages({
      'object.min': 'En az bir alan gönderilmelidir.',
    })
    .unknown(false),

  workRegionUpdate: joi
    .object({
      regionId: joi.string().uuid().required().messages({
        'string.empty': 'Çalışma bölgesi seçilmelidir.',
        'string.guid': 'Geçersiz bölge seçimi.',
      }),
    })
    .unknown(false),
};


module.exports = schemas;