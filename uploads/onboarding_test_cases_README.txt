AI Assisted Onboarding test PDFs

01 valid_full: expected success, no validation errors
02 valid_single_commodity: expected success with one commodity and one certification
03 warning_no_certification: expected warning only
04 error_no_country: expected validation error for missing country
05 error_no_commodity: expected validation error for missing commodity
06 error_unknown_country_keyword: expected validation error because extractor only knows a fixed country list
07 valid_multi_certifications: expected success with multiple certifications
08 error_blank_first_line: expected supplier name extraction edge case
09 ambiguous_geography: no explicit country, useful for ranked possible-country assist
10 indirect_country_signal: place reference implies a country, useful for Gemini remediation testing
11 noisy_ocr_style: OCR-distorted text for extraction and AI recovery testing
