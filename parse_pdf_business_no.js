/**
 * PDF 파일에서 사업자번호 파싱 후 DB 업데이트 스크립트
 * 실행: node parse_pdf_business_no.js
 */

const { createClient } = require('@supabase/supabase-js');
const https = require('https');
const http = require('http');
const pdfParse = require('pdf-parse');

// Supabase 설정
const SUPABASE_URL = 'https://zgyawfmjconubxaiamod.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpneWF3Zm1qY29udWJ4YWlhbW9kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE3NjQzNzIsImV4cCI6MjA2NzM0MDM3Mn0.shjBE2OQeILwkLLi4E6Bq0-b6YPUs-WFwquexdUiM9A';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// 사업자번호 정규화 함수
function normalizeBusinessNo(businessNo) {
    if (!businessNo) return null;
    const digits = businessNo.replace(/\D/g, '');
    if (digits.length === 10) {
        return `${digits.slice(0, 3)}-${digits.slice(3, 5)}-${digits.slice(5)}`;
    }
    return null;
}

// 텍스트에서 사업자번호 추출
function extractBusinessNo(text) {
    // 텍스트 정규화 (공백 제거)
    let normalized = text
        .replace(/([가-힣])\s+([가-힣])/g, '$1$2')
        .replace(/([가-힣])\s+([가-힣])/g, '$1$2')
        .replace(/(\d)\s+(\d)/g, '$1$2')
        .replace(/(\d)\s+(\d)/g, '$1$2')
        .replace(/(\d)\s+(\d)/g, '$1$2')
        .replace(/(\d)\s*-\s*(\d)/g, '$1-$2');

    // 사업자번호 패턴
    const patterns = [
        /(\d{3}-\d{2}-\d{5})/,
        /사업자번호\s*([\d-]+)/,
        /사업자[등록]*번호\s*:?\s*([\d-]+)/,
        /사업자\s*번호\s*([\d-]+)/,
        /(\d{3}\s*-?\s*\d{2}\s*-?\s*\d{5})/
    ];

    for (const pattern of patterns) {
        const match = normalized.match(pattern);
        if (match && match[1]) {
            const businessNo = normalizeBusinessNo(match[1]);
            if (businessNo) {
                return businessNo;
            }
        }
    }
    return null;
}

// URL에서 PDF 다운로드 및 텍스트 추출 (pdf-parse 사용)
async function fetchPdfText(url) {
    return new Promise((resolve, reject) => {
        const protocol = url.startsWith('https') ? https : http;

        protocol.get(url, (response) => {
            if (response.statusCode === 301 || response.statusCode === 302) {
                // 리다이렉트 처리
                fetchPdfText(response.headers.location).then(resolve).catch(reject);
                return;
            }

            const chunks = [];
            response.on('data', chunk => chunks.push(chunk));
            response.on('end', async () => {
                try {
                    const buffer = Buffer.concat(chunks);
                    // pdf-parse로 텍스트 추출
                    const data = await pdfParse(buffer);
                    resolve(data.text);
                } catch (err) {
                    reject(err);
                }
            });
            response.on('error', reject);
        }).on('error', reject);
    });
}

// 메인 실행 함수
async function main() {
    console.log('🚀 PDF 사업자번호 파싱 시작...\n');

    // PDF 파일이 있고 business_no가 없는 업체 조회
    const { data: companies, error } = await supabase
        .from('client_companies')
        .select('id, company_name, pdf_files, business_no')
        .not('pdf_files', 'eq', '[]')
        .or('business_no.is.null,business_no.eq.')
        .limit(600);

    if (error) {
        console.error('❌ 조회 오류:', error);
        return;
    }

    console.log(`📊 처리 대상: ${companies.length}개 업체\n`);

    let successCount = 0;
    let failCount = 0;
    let skipCount = 0;

    for (const company of companies) {
        try {
            const pdfFiles = company.pdf_files;
            if (!pdfFiles || pdfFiles.length === 0) {
                skipCount++;
                continue;
            }

            const pdfUrl = pdfFiles[0].url;
            console.log(`📄 처리 중: ${company.company_name} (ID: ${company.id})`);

            // PDF 텍스트 추출
            const text = await fetchPdfText(pdfUrl);

            // 사업자번호 추출
            const businessNo = extractBusinessNo(text);

            if (businessNo) {
                // DB 업데이트
                const { error: updateError } = await supabase
                    .from('client_companies')
                    .update({ business_no: businessNo })
                    .eq('id', company.id);

                if (updateError) {
                    console.log(`   ❌ 업데이트 실패: ${updateError.message}`);
                    failCount++;
                } else {
                    console.log(`   ✅ 사업자번호: ${businessNo}`);
                    successCount++;
                }
            } else {
                console.log(`   ⚠️ 사업자번호 찾을 수 없음`);
                failCount++;
            }

            // API 부하 방지를 위한 딜레이
            await new Promise(r => setTimeout(r, 100));

        } catch (err) {
            console.log(`   ❌ 오류: ${err.message}`);
            failCount++;
        }
    }

    console.log('\n========================================');
    console.log(`✅ 성공: ${successCount}개`);
    console.log(`❌ 실패: ${failCount}개`);
    console.log(`⏭️ 스킵: ${skipCount}개`);
    console.log('========================================');
}

main().catch(console.error);
