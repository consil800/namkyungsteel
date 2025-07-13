// 한국 달력 컴포넌트
class KoreanCalendar {
    constructor(targetElement, options = {}) {
        this.targetElement = targetElement;
        this.selectedDate = options.initialDate ? new Date(options.initialDate) : null;
        this.currentDate = new Date();
        this.viewDate = new Date(this.currentDate.getFullYear(), this.currentDate.getMonth(), 1);
        this.isVisible = false;
        this.onDateSelect = options.onDateSelect || (() => {});
        this.placeholder = options.placeholder || '날짜 선택';
        
        this.init();
    }

    // 한국 공휴일 데이터 (2024-2026년)
    getKoreanHolidays() {
        return {
            // 2024년
            '2024-01-01': '신정',
            '2024-02-09': '설날 연휴',
            '2024-02-10': '설날',
            '2024-02-11': '설날 연휴',
            '2024-02-12': '설날 대체휴일',
            '2024-03-01': '3·1절',
            '2024-04-10': '국회의원선거일',
            '2024-05-01': '근로자의 날',
            '2024-05-05': '어린이날',
            '2024-05-06': '어린이날 대체휴일',
            '2024-05-15': '부처님오신날',
            '2024-06-06': '현충일',
            '2024-08-15': '광복절',
            '2024-09-16': '추석 연휴',
            '2024-09-17': '추석',
            '2024-09-18': '추석 연휴',
            '2024-10-03': '개천절',
            '2024-10-09': '한글날',
            '2024-12-25': '크리스마스',
            
            // 2025년
            '2025-01-01': '신정',
            '2025-01-28': '설날 연휴',
            '2025-01-29': '설날',
            '2025-01-30': '설날 연휴',
            '2025-03-01': '3·1절',
            '2025-05-01': '근로자의 날',
            '2025-05-05': '어린이날',
            '2025-05-13': '부처님오신날',
            '2025-06-06': '현충일',
            '2025-08-15': '광복절',
            '2025-10-05': '추석 연휴',
            '2025-10-06': '추석',
            '2025-10-07': '추석 연휴',
            '2025-10-08': '추석 대체휴일',
            '2025-10-03': '개천절',
            '2025-10-09': '한글날',
            '2025-12-25': '크리스마스',
            
            // 2026년
            '2026-01-01': '신정',
            '2026-02-16': '설날 연휴',
            '2026-02-17': '설날',
            '2026-02-18': '설날 연휴',
            '2026-03-01': '3·1절',
            '2026-05-01': '근로자의 날',
            '2026-05-05': '어린이날',
            '2026-05-02': '부처님오신날',
            '2026-06-06': '현충일',
            '2026-08-15': '광복절',
            '2026-09-24': '추석 연휴',
            '2026-09-25': '추석',
            '2026-09-26': '추석 연휴',
            '2026-10-03': '개천절',
            '2026-10-09': '한글날',
            '2026-12-25': '크리스마스'
        };
    }

    init() {
        this.createCalendarInput();
        this.createCalendarPopup();
        this.bindEvents();
    }

    createCalendarInput() {
        // 기존 input을 감싸는 컨테이너 생성
        const container = document.createElement('div');
        container.className = 'korean-calendar-container';
        container.style.position = 'relative';

        // 새로운 input 생성
        const input = document.createElement('input');
        input.type = 'text';
        input.className = this.targetElement.className;
        input.name = this.targetElement.name;
        input.id = this.targetElement.id;
        input.placeholder = this.placeholder;
        input.readonly = true;
        input.style.cursor = 'pointer';

        // 달력 아이콘 추가
        const icon = document.createElement('span');
        icon.innerHTML = '📅';
        icon.style.cssText = `
            position: absolute;
            right: 10px;
            top: 50%;
            transform: translateY(-50%);
            cursor: pointer;
            user-select: none;
        `;

        // 기존 요소 교체
        this.targetElement.parentNode.insertBefore(container, this.targetElement);
        container.appendChild(input);
        container.appendChild(icon);
        this.targetElement.remove();

        this.inputElement = input;
        this.iconElement = icon;
        this.containerElement = container;

        // 초기값 설정
        if (this.selectedDate) {
            this.updateInputValue();
        }
    }

    createCalendarPopup() {
        const popup = document.createElement('div');
        popup.className = 'korean-calendar-popup';
        popup.style.cssText = `
            position: absolute;
            top: 100%;
            left: 0;
            z-index: 1000;
            background: white;
            border: 1px solid #ddd;
            border-radius: 8px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.15);
            padding: 15px;
            display: none;
            min-width: 320px;
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        `;

        this.containerElement.appendChild(popup);
        this.popupElement = popup;
        this.renderCalendar();
    }

    renderCalendar() {
        const year = this.viewDate.getFullYear();
        const month = this.viewDate.getMonth();
        
        const html = `
            <div class="calendar-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                <button type="button" class="prev-btn" style="background: none; border: none; font-size: 18px; cursor: pointer; padding: 5px;">‹</button>
                <div class="month-year" style="font-weight: bold; font-size: 16px;">
                    ${year}년 ${month + 1}월
                </div>
                <button type="button" class="next-btn" style="background: none; border: none; font-size: 18px; cursor: pointer; padding: 5px;">›</button>
            </div>
            <div class="calendar-body">
                ${this.renderCalendarDays()}
            </div>
            <div class="calendar-footer" style="margin-top: 10px; text-align: center;">
                <button type="button" class="today-btn" style="background: #3498db; color: white; border: none; padding: 5px 15px; border-radius: 4px; cursor: pointer; font-size: 12px;">오늘</button>
                <button type="button" class="clear-btn" style="background: #95a5a6; color: white; border: none; padding: 5px 15px; border-radius: 4px; cursor: pointer; font-size: 12px; margin-left: 5px;">지우기</button>
            </div>
        `;

        this.popupElement.innerHTML = html;
        this.bindCalendarEvents();
    }

    renderCalendarDays() {
        const year = this.viewDate.getFullYear();
        const month = this.viewDate.getMonth();
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const daysInMonth = lastDay.getDate();
        const startDay = firstDay.getDay(); // 0=일요일

        const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
        const holidays = this.getKoreanHolidays();

        let html = '<table style="width: 100%; border-collapse: collapse; table-layout: fixed;">';
        
        // 요일 헤더
        html += '<tr>';
        dayNames.forEach((day, index) => {
            let color = '#333';
            if (index === 0) color = '#e74c3c'; // 일요일
            if (index === 6) color = '#3498db'; // 토요일
            
            html += `<th style="padding: 8px; text-align: center; font-weight: bold; color: ${color}; font-size: 12px; height: 30px;">${day}</th>`;
        });
        html += '</tr>';

        // 날짜 렌더링
        let date = 1;
        for (let week = 0; week < 6; week++) {
            html += '<tr>';
            for (let day = 0; day < 7; day++) {
                if (week === 0 && day < startDay) {
                    // 이전 달의 날짜들
                    const prevMonth = new Date(year, month, 0);
                    const prevDate = prevMonth.getDate() - (startDay - day - 1);
                    html += `<td style="padding: 6px 4px; text-align: center; color: #ccc; cursor: pointer; font-size: 14px; height: 40px; vertical-align: top;">${prevDate}</td>`;
                } else if (date > daysInMonth) {
                    // 다음 달의 날짜들
                    const nextDate = date - daysInMonth;
                    html += `<td style="padding: 6px 4px; text-align: center; color: #ccc; cursor: pointer; font-size: 14px; height: 40px; vertical-align: top;">${nextDate}</td>`;
                    date++;
                } else {
                    // 현재 달의 날짜들
                    const currentDate = new Date(year, month, date);
                    const dateStr = this.formatDateForHoliday(currentDate);
                    const isHoliday = holidays[dateStr];
                    const isToday = this.isSameDate(currentDate, new Date());
                    const isSelected = this.selectedDate && this.isSameDate(currentDate, this.selectedDate);
                    
                    let dayColor = '#333';
                    let bgColor = 'transparent';
                    let hoverColor = '#f8f9fa';
                    
                    // 요일별 색상
                    if (day === 0 || isHoliday) {
                        dayColor = '#e74c3c'; // 일요일, 공휴일
                    } else if (day === 6) {
                        dayColor = '#3498db'; // 토요일
                    }
                    
                    // 오늘 날짜
                    if (isToday) {
                        bgColor = '#e8f4f8';
                        hoverColor = '#d1ecf1';
                    }
                    
                    // 선택된 날짜
                    if (isSelected) {
                        bgColor = '#3498db';
                        dayColor = 'white';
                        hoverColor = '#2980b9';
                    }
                    
                    const title = isHoliday ? isHoliday : '';
                    
                    // 공휴일이 있는 경우 날짜와 공휴일 이름을 함께 표시
                    const dateContent = isHoliday ? 
                        `<div style="line-height: 1.2;">${date}<div style="font-size: 8px; margin-top: 1px; font-weight: normal;">${isHoliday}</div></div>` : 
                        date;
                    
                    html += `<td class="calendar-day" data-date="${dateStr}" 
                        style="padding: 6px 4px; text-align: center; cursor: pointer; 
                               color: ${dayColor}; background-color: ${bgColor}; 
                               font-size: 14px; border-radius: 4px; 
                               transition: background-color 0.2s; 
                               vertical-align: top; height: 40px;" 
                        title="${title}"
                        onmouseover="this.style.backgroundColor='${hoverColor}'"
                        onmouseout="this.style.backgroundColor='${bgColor}'">${dateContent}</td>`;
                    date++;
                }
            }
            html += '</tr>';
            
            if (date > daysInMonth) break;
        }
        
        html += '</table>';
        return html;
    }

    bindEvents() {
        // 입력 필드 클릭
        this.inputElement.addEventListener('click', () => {
            this.toggleCalendar();
        });

        // 아이콘 클릭
        this.iconElement.addEventListener('click', () => {
            this.toggleCalendar();
        });

        // 외부 클릭시 달력 닫기
        document.addEventListener('click', (e) => {
            if (!this.containerElement.contains(e.target)) {
                this.hideCalendar();
            }
        });
    }

    bindCalendarEvents() {
        // 이전/다음 버튼 (이벤트 전파 중지 추가)
        this.popupElement.querySelector('.prev-btn').addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.viewDate.setMonth(this.viewDate.getMonth() - 1);
            this.renderCalendar();
        });

        this.popupElement.querySelector('.next-btn').addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.viewDate.setMonth(this.viewDate.getMonth() + 1);
            this.renderCalendar();
        });

        // 오늘 버튼
        this.popupElement.querySelector('.today-btn').addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.selectDate(new Date());
        });

        // 지우기 버튼
        this.popupElement.querySelector('.clear-btn').addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.clearDate();
        });

        // 날짜 선택
        this.popupElement.querySelectorAll('.calendar-day').forEach(dayElement => {
            dayElement.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const dateStr = dayElement.getAttribute('data-date');
                if (dateStr) {
                    this.selectDate(new Date(dateStr));
                }
            });
        });
    }

    toggleCalendar() {
        if (this.isVisible) {
            this.hideCalendar();
        } else {
            this.showCalendar();
        }
    }

    showCalendar() {
        this.popupElement.style.display = 'block';
        this.isVisible = true;
        
        // 선택된 날짜가 있으면 해당 월로 이동
        if (this.selectedDate) {
            this.viewDate = new Date(this.selectedDate.getFullYear(), this.selectedDate.getMonth(), 1);
            this.renderCalendar();
        }
    }

    hideCalendar() {
        this.popupElement.style.display = 'none';
        this.isVisible = false;
    }

    selectDate(date) {
        this.selectedDate = new Date(date);
        this.updateInputValue();
        this.onDateSelect(this.selectedDate);
        this.hideCalendar();
    }

    clearDate() {
        this.selectedDate = null;
        this.inputElement.value = '';
        this.onDateSelect(null);
        this.hideCalendar();
    }

    updateInputValue() {
        if (this.selectedDate) {
            const year = this.selectedDate.getFullYear();
            const month = String(this.selectedDate.getMonth() + 1).padStart(2, '0');
            const day = String(this.selectedDate.getDate()).padStart(2, '0');
            this.inputElement.value = `${year}-${month}-${day}`;
        }
    }

    formatDateForHoliday(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    isSameDate(date1, date2) {
        return date1.getFullYear() === date2.getFullYear() &&
               date1.getMonth() === date2.getMonth() &&
               date1.getDate() === date2.getDate();
    }

    // 외부에서 날짜 설정
    setDate(date) {
        if (date) {
            this.selectedDate = new Date(date);
            this.updateInputValue();
        } else {
            this.clearDate();
        }
    }

    // 현재 선택된 날짜 반환
    getDate() {
        return this.selectedDate;
    }

    // 문자열 형태로 날짜 반환
    getDateString() {
        return this.selectedDate ? this.formatDateForHoliday(this.selectedDate) : '';
    }
}