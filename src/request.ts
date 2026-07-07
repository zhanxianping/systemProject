import axios, { AxiosInstance, AxiosRequestConfig } from 'axios'
import store from '@/store/index'
import router from '@/router/index'
import { message } from 'ant-design-vue'
import { IdentityServices } from './identity'

/**
 * 后端统一响应结构
 */
export interface ResponseData<T = unknown> {
  code: string | number;
  message: string;
  data: T;
  errors: any;
  isSuccess: boolean;
}

interface RequestConfig extends AxiosRequestConfig {
  message?: boolean,
  type?: 'form' | 'json'
}

interface InternalAxiosRequestConfig extends AxiosRequestConfig {
  message?: boolean,
  type?: 'form' | 'json'
}

const instance: AxiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  timeout: 60 * 1000,
})

instance.interceptors.request.use(
  config => {
    const token = store.getters['user/getToken']()
    if (token) {
      config.headers['Authorization'] = 'Bearer ' + token
    }
    return config
  },
  error => {
    return Promise.reject(error)
  },
)

instance.interceptors.response.use(
  response => {
    const { config, data } = response
    if (data && typeof data === 'object') {
      if (data.isSuccess) {
        return Promise.resolve(data)
      } else {
        (typeof config.message === 'undefined' || config.message) && message.error(data.message)
        return Promise.reject(data)
      }
    }
    return Promise.reject(response)
  },
  error => {
    if (!error.response) {
      message.error(error.message)
      return Promise.reject(error)
    }
    if (error.response.status === 401) {
      message.warn('登录过期，请重新登录')
      IdentityServices.logout().finally(() => {
        router.push({ path: '/login' })
      })
      return Promise.reject(error.response)
    }
    // 有响应的情况：后端返回了结果（即使是错误）
    if (error.response.data) {
      const { data, config } = error.response
      if (data && typeof data === 'object') {
        (typeof config.message === 'undefined' || config.message) && message.error(data.message)
        // 失败：直接抛出 message
        return Promise.reject(data)
      }
    }
    return Promise.reject(error.response)
  },
)

/**
 * 将对象转换为 FormData
 * @param {Object} data 要转换的对象
 * @param {FormData} formData
 * @param {String} pName
 * @returns {FormData}
 */
function objectToFormData(data: any, formData?: FormData, pName: string = ''): FormData {
  if (typeof data !== 'object') {
    return data
  }
  if (!formData) {
    formData = new FormData()
  }
  if (Array.isArray(data)) {
    for (let i = 0; i < data.length; i++) {
      formData.append(pName + `[${i}]`, data[i])
    }
    return formData
  }
  for (const key in data) {
    if (typeof data[key] === 'undefined') {
      continue
    }
    if (Array.isArray(data[key])) {
      objectToFormData(data[key], formData, pName + key)
      continue
    }
    if (Object.prototype.toString.call(data[key]) === '[object Object]') {
      objectToFormData(data[key], formData, pName + key + '.')
      continue
    }
    formData.append(pName + key, data[key])
  }

  return formData
}

function objectToQuery(data: any): string {
  if (typeof data !== 'object') {
    return ''
  }
  const result: string[] = []

  function parseObj(obj: any, pName: string = '') {
    for (let key in obj) {
      if (typeof obj[key] === 'undefined' || obj[key] === null) {
        continue
      }
      if (Array.isArray(obj[key])) {
        for (let i = 0; i < obj[key].length; i++) {
          if (typeof obj[key][i] === 'undefined' || obj[key][i] === null) {
            continue
          }
          result.push(pName + key + `=${window.encodeURIComponent(obj[key][i])}`)
        }
        continue
      }
      if (Object.prototype.toString.call(obj[key]) === '[object Object]') {
        parseObj(obj[key], pName + key + '.')
        continue
      }
      result.push(pName + key + '=' + window.encodeURIComponent(obj[key]))
    }
  }

  parseObj(data)
  return '?' + result.join('&')
}


export const request = {
  get<T>(url: string, params?: any, config: RequestConfig = {}): Promise<ResponseData<T>> {
    return instance.get(url + objectToQuery(params), config)
  },
  post<T>(url: string, data: any, config: RequestConfig = {}): Promise<ResponseData<T>> {
    if (config.type === 'form') {
      data = objectToFormData(data)
    }
    return instance.post(url, data, config)
  },
  put<T>(url: string, data: any, config: RequestConfig = {}): Promise<ResponseData<T>> {
    if (config.type === 'form') {
      data = objectToFormData(data)
    }
    return instance.put(url, data, config)
  },
  delete<T>(url: string, params?: any, config: RequestConfig = {}): Promise<ResponseData<T>> {
    return instance.delete(url + objectToQuery(params), config)
  },
  patch<T>(url: string, data: any, config: RequestConfig = {}): Promise<ResponseData<T>> {
    return instance.patch(url, data, config)
  },
}


