// 업체 등록 페이지 JavaScript
// 버전: 2026-01-06 - PDF 드래그 앤 드롭 및 사업자번호 중복체크 추가

let currentUser = null;
let parsedPdfFile = null;  // 파싱된 PDF 파일 저장
let businessNoValid = true;  // 사업자번호 유효성 상태

document.addEventListener('DOMContentLoaded', async function() {
    console.log('📄 업체 등록 페이지 로드 시작');

    // 간단한 사용자 인증
    currentUser = await window.dataLoader.getCurrentUser();
    if (!currentUser) {
        alert('로그인이 필요합니다.');
        window.location.href = 'login.html';
        return;
    }

    console.log('✅ 현재 사용자:', currentUser.name);

    // 드롭다운 옵션 로드
    await loadDropdownOptions();

    // PDF 드래그 앤 드롭 초기화
    initPdfDropzone();

    // 사업자번호 중복 체크 이벤트
    initBusinessNoCheck();

    const form = document.getElementById('companyForm');
    const submitBtn = document.getElementById('submitBtn');
    const cancelBtn = document.getElementById('cancelBtn');

    // 폼 제출 이벤트
    form.addEventListener('submit', async function(e) {
        e.preventDefault();
        console.log('폼 제출 시작');

        // 사업자번호 최종 검증
        const businessNoInput = document.getElementById('businessNo');
        const businessNo = normalizeBusinessNo(businessNoInput.value);

        if (businessNo) {
            const isDuplicate = await checkBusinessNoDuplicate(businessNo);
            if (isDuplicate) {
                alert('이미 등록된 사업자번호입니다. 다른 사업자번호를 입력해주세요.');
                businessNoInput.focus();
                return;
            }
        }

        const formData = new FormData(form);
        const companyData = {
            company_name: formData.get('companyName').trim(),
            business_no: businessNo || null,  // 사업자번호 추가
            region: formData.get('region').trim(),
            address: formData.get('address').trim(),
            phone: formData.get('phone').trim(),
            contact_person: formData.get('contactPerson').trim(),
            mobile: formData.get('mobile').trim(),
            email: formData.get('email').trim(),
            payment_terms: formData.get('paymentTerms').trim(),
            debt_amount: formData.get('debtAmount').trim(),
            business_type: formData.get('businessType').trim(),
            products: formData.get('products').trim(),
            usage_items: formData.get('usageItems').trim(),
            notes: formData.get('notes').trim(),
            color_code: formData.get('companyColor') || '',
            visit_count: 0,
            last_visit_date: null,
            user_id: currentUser.id,
            company_domain: currentUser.company_domain || 'namkyungsteel.com'
        };

        console.log('폼 데이터:', companyData);

        // 필수 필드 검증
        if (!companyData.company_name) {
            alert('업체명을 입력해주세요.');
            document.getElementById('companyName').focus();
            return;
        }

        if (!companyData.region) {
            alert('지역을 선택해주세요.');
            document.getElementById('region').focus();
            return;
        }

        try {
            submitBtn.disabled = true;
            submitBtn.textContent = '등록 중...';

            console.log('📝 업체 등록 시작');

            // 업체 등록
            const result = await window.dataLoader.createCompany(companyData, currentUser.id);

            if (result.success) {
                // PDF 파일 업로드 (파싱된 파일이 있는 경우)
                if (parsedPdfFile && result.data && result.data.id) {
                    console.log('📎 PDF 파일 업로드 시작');
                    await uploadPdfFile(result.data.id, parsedPdfFile);
                }

                alert('업체가 성공적으로 등록되었습니다.');

                // 데이터 변경 알림 (자동 캐시 무효화 및 새로고침 포함)
                if (currentUser.id && window.dataChangeManager) {
                    window.dataChangeManager.notifyChange(currentUser.id, 'create');
                }

                // worklog.html로 이동하여 새로 등록된 업체 확인
                setTimeout(() => {
                    window.location.href = 'worklog.html';
                }, 200);
            } else {
                throw new Error('업체 등록에 실패했습니다.');
            }

        } catch (error) {
            console.error('업체 등록 오류:', error);
            alert('업체 등록 중 오류가 발생했습니다: ' + error.message);
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = '등록';
        }
    });

    // 취소 버튼
    if (cancelBtn) {
        cancelBtn.addEventListener('click', function() {
            if (confirm('작성 중인 내용이 사라집니다. 정말로 취소하시겠습니까?')) {
                window.location.href = 'worklog.html';
            }
        });
    }
});

// ========================================
// PDF 드래그 앤 드롭 기능
// ========================================

function initPdfDropzone() {
    const dropzone = document.getElementById('pdfDropzone');
    const fileInput = document.getElementById('pdfFileInput');
    const clearBtn = document.getElementById('clearParseBtn');

    if (!dropzone || !fileInput) return;

    // 클릭하여 파일 선택
    dropzone.addEventListener('click', () => fileInput.click());

    // 파일 선택 이벤트
    fileInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (file && file.type === 'application/pdf') {
            await handlePdfFile(file);
        }
    });

    // 드래그 오버
    dropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropzone.classList.add('drag-over');
    });

    // 드래그 리브
    dropzone.addEventListener('dragleave', (e) => {
        e.preventDefault();
        dropzone.classList.remove('drag-over');
    });

    // 드롭
    dropzone.addEventListener('drop', async (e) => {
        e.preventDefault();
        dropzone.classList.remove('drag-over');

        const file = e.dataTransfer.files[0];
        if (file && file.type === 'application/pdf') {
            await handlePdfFile(file);
        } else {
            alert('PDF 파일만 업로드 가능합니다.');
        }
    });

    // 초기화 버튼
    if (clearBtn) {
        clearBtn.addEventListener('click', clearParseResult);
    }
}

// PDF 파일 처리
async function handlePdfFile(file) {
    console.log('📄 PDF 파일 처리 시작:', file.name);

    try {
        // 텍스트 추출
        const text = await extractTextFromPdf(file);
        console.log('📄 추출된 텍스트:', text.substring(0, 500) + '...');

        // CRETOP 형식 파싱
        const parsed = parseCretopPdf(text);
        console.log('📄 파싱 결과:', parsed);

        if (parsed.companyName || parsed.businessNo || parsed.address || parsed.phone) {
            // 파싱 성공 - 폼에 자동 입력
            fillFormWithParsedData(parsed);

            // 미리보기 표시
            showParsePreview(parsed);

            // PDF 파일 저장 (업체 등록 시 업로드용)
            parsedPdfFile = file;
        } else {
            alert('PDF에서 업체 정보를 찾을 수 없습니다. CRETOP 형식의 PDF인지 확인해주세요.');
        }
    } catch (error) {
        console.error('PDF 처리 오류:', error);
        alert('PDF 파일을 처리하는 중 오류가 발생했습니다.');
    }
}

// PDF 텍스트 추출 (PDF.js 사용)
async function extractTextFromPdf(file) {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

    let fullText = '';
    const maxPages = Math.min(pdf.numPages, 2);  // 처음 2페이지만 추출

    for (let i = 1; i <= maxPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map(item => item.str).join(' ');
        fullText += pageText + '\n';
    }

    return fullText;
}

// CRETOP PDF 파싱
function parseCretopPdf(text) {
    const result = {
        companyName: '',
        businessNo: '',
        region: '',
        address: '',
        phone: ''
    };

    // 디버깅: 추출된 원본 텍스트
    console.log('=== PDF 원본 텍스트 ===');
    console.log(text.substring(0, 500));

    // PDF.js가 문자 사이에 공백을 넣어서 추출하는 경우 정규화
    // "기 업   종 합   보 고 서" -> "기업종합보고서"
    // "( 주 ) 하 이 진" -> "(주)하이진"
    // "7 1 9 - 8 6 - 0 2 4 9 8" -> "719-86-02498"
    let normalizedText = text
        // 한글 문자 사이의 단일 공백 제거: "기 업" -> "기업"
        .replace(/([가-힣])\s+([가-힣])/g, '$1$2')
        // 여러 번 적용 (연속된 문자들 처리)
        .replace(/([가-힣])\s+([가-힣])/g, '$1$2')
        .replace(/([가-힣])\s+([가-힣])/g, '$1$2')
        // 괄호와 한글 사이 공백 제거: "( 주 )" -> "(주)"
        .replace(/\(\s+/g, '(')
        .replace(/\s+\)/g, ')')
        // 닫는 괄호 뒤 한글과의 공백 제거: ") 하" -> ")하"
        .replace(/\)\s+([가-힣])/g, ')$1')
        // 한글 뒤 여는 괄호와의 공백 제거: "주 (" -> "주("
        .replace(/([가-힣])\s+\(/g, '$1(')
        // 숫자 사이의 공백 제거: "7 1 9" -> "719"
        .replace(/(\d)\s+(\d)/g, '$1$2')
        .replace(/(\d)\s+(\d)/g, '$1$2')
        .replace(/(\d)\s+(\d)/g, '$1$2')
        // 숫자와 하이픈 사이 공백 제거: "719 - 86" -> "719-86"
        .replace(/(\d)\s*-\s*(\d)/g, '$1-$2')
        // 연속 공백을 단일 공백으로
        .replace(/\s{2,}/g, ' ');

    console.log('=== 정규화된 텍스트 ===');
    console.log(normalizedText.substring(0, 500));
    console.log('========================');

    // 이후 파싱은 정규화된 텍스트 사용
    text = normalizedText;

    // 사업자번호 먼저 추출 (가장 신뢰할 수 있는 패턴)
    const businessNoPatterns = [
        /(\d{3}-\d{2}-\d{5})/,  // 직접 패턴 매칭 (가장 우선)
        /사업자번호\s+([\d-]+)/,  // "사업자번호 719-86-02498"
        /-\s*사업자번호\s*:\s*([\d-]+)/,  // "- 사업자번호 : 719-86-02498"
        /사업자[등록]*번호\s*:?\s*([\d-]+)/
    ];
    for (const pattern of businessNoPatterns) {
        const match = text.match(pattern);
        if (match && match[1]) {
            const normalized = normalizeBusinessNo(match[1]);
            if (normalized && normalized.length >= 10) {
                result.businessNo = normalized;
                console.log('사업자번호 추출:', result.businessNo);
                break;
            }
        }
    }

    // 업체명 추출 - CRETOP 페이지2 테이블 형식 우선: "기업명 (주)하이진 영문기업명"
    const companyPatterns = [
        /기업명\s+(\([주유]\)[가-힣A-Za-z0-9]+)/,  // "기업명 (주)하이진" - 테이블 형식
        /기업명\s+([가-힣A-Za-z0-9\(\)]+?)(?:\s+영문기업명|\s+사업자번호)/,  // 뒤에 영문기업명이나 사업자번호가 오는 경우
        /-\s*기업명\s*:\s*([가-힣A-Za-z0-9\(\)]+)/,  // "- 기업명 : (주)하이진"
        /기업명\s*:\s*([가-힣A-Za-z0-9\(\)]+)/,
        /상호\s*:?\s*([가-힣A-Za-z0-9\(\)]+)/,
        /(\([주유]\)[가-힣]+)/  // 마지막 fallback: "(주)하이진" 직접 패턴
    ];
    for (const pattern of companyPatterns) {
        const match = text.match(pattern);
        if (match && match[1]) {
            let companyName = match[1].trim();
            // 불필요한 문자 제거
            companyName = companyName.replace(/\s*\d{4}[-\/]\d{2}[-\/]\d{2}.*$/, '');
            // (주), (유) 제거
            companyName = companyName.replace(/^\([주유]\)/, '');
            if (companyName.length > 1) {
                result.companyName = companyName;
                console.log('업체명 추출:', result.companyName);
                break;
            }
        }
    }

    // 주소 추출 - CRETOP 페이지2 형식: "주소 (50801)경남김해시생림면생림대로491(나전리)"
    const addressPatterns = [
        /주소\s*\((\d{5})\)([가-힣0-9\-\(\)]+)/,  // "주소(50801)경남김해시..." 또는 "주소 (50801)..."
        /주소\s+(\d{5})([가-힣][가-힣0-9\-\(\)]+)/,  // "주소 50801경남김해시..."
        /주소\s+([가-힣][가-힣0-9\s\-\(\)]+?)(?=\s+표준산업분류|\s+전화번호|\s+홈페이지|$)/,
        /-\s*주소\s*:\s*([가-힣0-9\s\-\(\)]+)/,
        /본점.*주소[:\s]*([가-힣][가-힣0-9\s\-\(\)]+)/,
        /\((\d{5})\)([가-힣][가-힣0-9\-\(\)]+[시군구])/  // 우편번호로 시작하는 패턴
    ];
    for (const pattern of addressPatterns) {
        const match = text.match(pattern);
        if (match) {
            if (match[2]) {
                // 우편번호 제외하고 주소만 사용
                result.address = match[2].trim();
            } else if (match[1]) {
                result.address = match[1].trim();
            }
            // 주소 정리
            result.address = result.address.replace(/\s+/g, ' ');
            // 끝에 괄호로 싸인 동/리 이름 제거: "(나전리)" -> ""
            result.address = result.address.replace(/\([가-힣]+[동리]\)$/, '');
            // 앞에 우편번호가 있으면 제거
            result.address = result.address.replace(/^\d{5}/, '');
            if (result.address.length > 100) {
                result.address = result.address.substring(0, 100);
            }
            if (result.address.length > 5) {
                console.log('주소 추출:', result.address);
                break;
            }
        }
    }

    // 지역 추출 (주소에서 시/군 이름 추출, "시" 또는 "군" 제거)
    if (result.address) {
        // 패턴: "경남김해시" -> "김해", "충남홍성군" -> "홍성"
        const cityMatch = result.address.match(/(?:서울|부산|대구|인천|광주|대전|울산|세종|경기|강원|충북|충남|전북|전남|경북|경남|제주)?([가-힣]{2,4})[시군]/);
        if (cityMatch && cityMatch[1]) {
            result.region = cityMatch[1];  // "김해시"에서 "김해"만, "홍성군"에서 "홍성"만 추출
            console.log('지역 추출:', result.region);
        }
    }

    // 전화번호 추출
    const phonePatterns = [
        /전화번호\s+([\d\-]+)/,  // 테이블 형식
        /대표전화\s+([\d\-]+)/,
        /-\s*대표전화\s*:\s*([\d\-]+)/,
        /TEL\s*:?\s*([\d\-]+)/i,
        /(\d{2,4}-\d{3,4}-\d{4})/  // 직접 전화번호 패턴
    ];
    for (const pattern of phonePatterns) {
        const match = text.match(pattern);
        if (match && match[1]) {
            const phone = match[1].trim();
            // 유효한 전화번호인지 확인 (최소 7자리)
            if (phone.replace(/-/g, '').length >= 7) {
                result.phone = phone;
                console.log('전화번호 추출:', result.phone);
                break;
            }
        }
    }

    console.log('=== 파싱 결과 ===', result);
    return result;
}

// 파싱 결과로 폼 자동 입력
function fillFormWithParsedData(parsed) {
    if (parsed.companyName) {
        document.getElementById('companyName').value = parsed.companyName;
    }
    if (parsed.businessNo) {
        document.getElementById('businessNo').value = parsed.businessNo;
        // 사업자번호 중복 체크 트리거
        checkAndUpdateBusinessNoStatus(parsed.businessNo);
    }
    if (parsed.region) {
        const regionSelect = document.getElementById('region');
        // 지역 드롭다운에서 매칭되는 옵션 찾기
        for (let option of regionSelect.options) {
            if (option.text.includes(parsed.region) || option.value.includes(parsed.region)) {
                regionSelect.value = option.value;
                break;
            }
        }
    }
    if (parsed.address) {
        document.getElementById('address').value = parsed.address;
    }
    if (parsed.phone) {
        document.getElementById('phone').value = parsed.phone;
    }

    // 기본 색상을 초록(green)으로 설정
    const colorSelect = document.getElementById('companyColor');
    if (colorSelect) {
        // 옵션 value가 한글인 경우와 영어인 경우 모두 처리
        for (let option of colorSelect.options) {
            if (option.value === 'green' || option.text === '초록' || option.value === '초록') {
                colorSelect.value = option.value;
                break;
            }
        }
    }
}

// 파싱 미리보기 표시
function showParsePreview(parsed) {
    const preview = document.getElementById('parsePreview');
    const content = document.getElementById('parsePreviewContent');

    let html = '';
    if (parsed.companyName) {
        html += `<div class="parse-preview-item"><label>업체명:</label><span>${parsed.companyName}</span></div>`;
    }
    if (parsed.businessNo) {
        html += `<div class="parse-preview-item"><label>사업자번호:</label><span>${parsed.businessNo}</span></div>`;
    }
    if (parsed.region) {
        html += `<div class="parse-preview-item"><label>지역:</label><span>${parsed.region}</span></div>`;
    }
    if (parsed.address) {
        html += `<div class="parse-preview-item"><label>주소:</label><span>${parsed.address}</span></div>`;
    }
    if (parsed.phone) {
        html += `<div class="parse-preview-item"><label>전화번호:</label><span>${parsed.phone}</span></div>`;
    }

    content.innerHTML = html;
    preview.classList.add('show');
}

// 파싱 결과 초기화
function clearParseResult() {
    const preview = document.getElementById('parsePreview');
    const content = document.getElementById('parsePreviewContent');

    preview.classList.remove('show');
    content.innerHTML = '';
    parsedPdfFile = null;

    // 파일 입력 초기화
    document.getElementById('pdfFileInput').value = '';
}

// ========================================
// 사업자번호 중복 체크 기능
// ========================================

function initBusinessNoCheck() {
    const businessNoInput = document.getElementById('businessNo');
    if (!businessNoInput) return;

    // blur 이벤트로 중복 체크
    businessNoInput.addEventListener('blur', async function() {
        const value = this.value.trim();
        if (value) {
            await checkAndUpdateBusinessNoStatus(value);
        } else {
            clearBusinessNoStatus();
        }
    });

    // 입력 중 자동 하이픈 추가
    businessNoInput.addEventListener('input', function() {
        let value = this.value.replace(/[^0-9]/g, '');
        if (value.length > 3) {
            value = value.slice(0, 3) + '-' + value.slice(3);
        }
        if (value.length > 6) {
            value = value.slice(0, 6) + '-' + value.slice(6, 11);
        }
        this.value = value;
    });
}

// 사업자번호 정규화 (하이픈 포함 형식으로)
function normalizeBusinessNo(input) {
    if (!input) return '';

    // 숫자만 추출
    const digits = input.replace(/[^0-9]/g, '');

    if (digits.length !== 10) return input.trim();  // 10자리가 아니면 원본 반환

    // 000-00-00000 형식으로 변환
    return `${digits.slice(0, 3)}-${digits.slice(3, 5)}-${digits.slice(5, 10)}`;
}

// 사업자번호 중복 체크
async function checkBusinessNoDuplicate(businessNo) {
    if (!businessNo) return false;

    try {
        const normalized = normalizeBusinessNo(businessNo);

        // Supabase에서 동일 사업자번호 검색
        const { data, error } = await window.db.client
            .from('companies')
            .select('id, company_name')
            .eq('business_no', normalized)
            .limit(1);

        if (error) {
            console.error('사업자번호 중복 체크 오류:', error);
            return false;  // 오류 시 중복 아님으로 처리
        }

        return data && data.length > 0;
    } catch (error) {
        console.error('사업자번호 중복 체크 오류:', error);
        return false;
    }
}

// 사업자번호 상태 업데이트
async function checkAndUpdateBusinessNoStatus(value) {
    const statusDiv = document.getElementById('businessNoStatus');
    const normalized = normalizeBusinessNo(value);

    if (!normalized || normalized.length < 12) {
        clearBusinessNoStatus();
        return;
    }

    // 체크 중 표시
    statusDiv.textContent = '확인 중...';
    statusDiv.className = 'business-no-status checking';

    const isDuplicate = await checkBusinessNoDuplicate(normalized);

    if (isDuplicate) {
        statusDiv.textContent = '이미 등록된 사업자번호입니다';
        statusDiv.className = 'business-no-status duplicate';
        businessNoValid = false;
    } else {
        statusDiv.textContent = '사용 가능한 사업자번호입니다';
        statusDiv.className = 'business-no-status valid';
        businessNoValid = true;
    }
}

// 사업자번호 상태 초기화
function clearBusinessNoStatus() {
    const statusDiv = document.getElementById('businessNoStatus');
    if (statusDiv) {
        statusDiv.textContent = '';
        statusDiv.className = 'business-no-status';
    }
    businessNoValid = true;
}

// ========================================
// PDF 파일 업로드
// ========================================

async function uploadPdfFile(companyId, file) {
    try {
        // 파일명 생성 (타임스탬프 + 원본 파일명)
        const timestamp = Date.now();
        const safeFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
        const fileName = `${companyId}/${timestamp}_${safeFileName}`;

        // Supabase Storage에 업로드
        const { data, error } = await window.db.client.storage
            .from('company-pdfs')
            .upload(fileName, file, {
                cacheControl: '3600',
                upsert: false
            });

        if (error) {
            console.error('PDF 업로드 오류:', error);
            return null;
        }

        // 업체 정보에 PDF 파일 경로 추가
        const publicUrl = window.db.client.storage
            .from('company-pdfs')
            .getPublicUrl(fileName).data.publicUrl;

        // companies 테이블의 pdf_files 필드 업데이트
        await window.db.client
            .from('companies')
            .update({
                pdf_files: [{
                    name: file.name,
                    url: publicUrl,
                    uploaded_at: new Date().toISOString()
                }]
            })
            .eq('id', companyId);

        console.log('📎 PDF 업로드 완료:', publicUrl);
        return publicUrl;
    } catch (error) {
        console.error('PDF 업로드 오류:', error);
        return null;
    }
}

// ========================================
// 드롭다운 옵션 로드
// ========================================

async function loadDropdownOptions() {
    console.log('드롭다운 옵션 로드 시작');

    try {
        // 데이터베이스 초기화 대기
        if (!window.DropdownLoader) {
            console.error('DropdownLoader가 로드되지 않았습니다.');
            loadBasicOptions();
            return;
        }

        // 각 드롭다운 로드 (직접입력 옵션 없이)
        const regionSelect = document.getElementById('region');
        if (regionSelect) {
            await DropdownLoader.loadRegionsOnly(regionSelect);
        }

        const paymentTermsSelect = document.getElementById('paymentTerms');
        if (paymentTermsSelect) {
            await DropdownLoader.loadPaymentTermsOnly(paymentTermsSelect);
        }

        const businessTypeSelect = document.getElementById('businessType');
        if (businessTypeSelect) {
            await DropdownLoader.loadBusinessTypesOnly(businessTypeSelect);
        }

        const colorSelect = document.getElementById('companyColor');
        if (colorSelect) {
            await DropdownLoader.loadColorsOnly(colorSelect);
        }

        console.log('드롭다운 옵션 로드 완료');

    } catch (error) {
        console.error('드롭다운 옵션 로드 오류:', error);

        // 오류 시 최소한의 기본값 로드
        loadBasicOptions();
    }
}

// 빈 옵션 로드 (오류 시 백업)
function loadBasicOptions() {
    console.log('빈 옵션 로드 - 사용자가 설정 페이지에서 항목을 추가해야 합니다.');

    // 드롭다운에는 기본 선택 옵션만 남겨두고 직접입력 옵션은 제거
    const regionSelect = document.getElementById('region');
    if (regionSelect && regionSelect.options.length <= 1) {
        console.log('지역 드롭다운이 비어있습니다. 설정 페이지에서 항목을 추가하세요.');
    }

    const paymentTermsSelect = document.getElementById('paymentTerms');
    if (paymentTermsSelect && paymentTermsSelect.options.length <= 1) {
        console.log('결제조건 드롭다운이 비어있습니다. 설정 페이지에서 항목을 추가하세요.');
    }

    const businessTypeSelect = document.getElementById('businessType');
    if (businessTypeSelect && businessTypeSelect.options.length <= 1) {
        console.log('업종 드롭다운이 비어있습니다. 설정 페이지에서 항목을 추가하세요.');
    }

    const colorSelect = document.getElementById('companyColor');
    if (colorSelect && colorSelect.options.length <= 1) {
        console.log('색상 드롭다운이 비어있습니다. 설정 페이지에서 항목을 추가하세요.');
    }
}

// 텍스트 대비 색상 계산
function getContrastColor(hexcolor) {
    if (!hexcolor) return '#000000';

    // # 제거
    hexcolor = hexcolor.replace('#', '');

    // RGB 값 추출
    const r = parseInt(hexcolor.substr(0, 2), 16);
    const g = parseInt(hexcolor.substr(2, 2), 16);
    const b = parseInt(hexcolor.substr(4, 2), 16);

    // 밝기 계산
    const brightness = ((r * 299) + (g * 587) + (b * 114)) / 1000;

    return brightness > 155 ? '#000000' : '#ffffff';
}
