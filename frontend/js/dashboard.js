/* =========================================================
   SPPU RESULT ANALYZER
   DASHBOARD.JS
========================================================= */


/* =========================================================
   GLOBAL VARIABLES
========================================================= */

let students = [];

let filteredStudents = [];

let selectedStudent = null;

const API_BASE_URL =
    "http://127.0.0.1:8000";


/* =========================================================
   CHART INSTANCES
========================================================= */

let resultChartInstance = null;

let sgpaChartInstance = null;

let gradeChartInstance = null;

let semesterChartInstance = null;


/* =========================================================
   LOAD RESULT DATA
========================================================= */

async function loadResultData() {

    try {

        const response = await fetch(
            `${API_BASE_URL}/api/results/parse?t=${Date.now()}`
        );


        if (!response.ok) {

            throw new Error(
                "Failed to load result data."
            );

        }


        const data =
            await response.json();


        /*
         * Store result temporarily
         */
        sessionStorage.setItem(
            "resultData",
            JSON.stringify(data)
        );


        /*
         * Load students
         */
        loadStudents(data);


    } catch (error) {

        console.error(
            "Error loading result:",
            error
        );


        const tableBody =
            document.getElementById(
                "studentTableBody"
            );


        if (tableBody) {

            tableBody.innerHTML = `
                <tr>
                    <td colspan="8">
                        Failed to load student data.
                    </td>
                </tr>
            `;

        }

    }

}


/* =========================================================
   LOAD / DISPLAY STUDENTS
========================================================= */

function loadStudents(data) {

    /*
     * Safely get students array
     */

    students =
        Array.isArray(data?.students)
            ? data.students
            : [];


    /*
     * Sort students by SGPA
     *
     * Highest SGPA = Rank 1
     */

    students.sort(
        (a, b) => {

            const sgpaA =
                Number(
                    a?.overall_sgpa || 0
                );


            const sgpaB =
                Number(
                    b?.overall_sgpa || 0
                );


            return sgpaB - sgpaA;

        }
    );


    /*
     * Reset filtered list
     */

    filteredStudents =
        [...students];


    /*
     * Update dashboard statistics
     */

    updateStatistics();


    /*
     * Populate semester dropdown
     */

    populateSemesterFilter();


    /*
     * Render student table
     *
     * IMPORTANT:
     * Table is rendered before analytics.
     * Therefore an analytics error will not
     * destroy the table.
     */

    renderStudents();


    /*
     * Update analytics summary
     */

    updateAnalyticsSummary();


    /*
     * If analytics is already open,
     * refresh charts.
     */

    const analyticsContent =
        document.getElementById(
            "analyticsContent"
        );


    if (
        analyticsContent &&
        analyticsContent.classList.contains("active")
    ) {

        requestAnimationFrame(
            () => {

                renderPerformanceCharts();

            }
        );

    }

}


/* =========================================================
   RENDER STUDENT TABLE
========================================================= */

function renderStudents() {

    const tableBody =
        document.getElementById(
            "studentTableBody"
        );


    if (!tableBody) {

        console.error(
            "studentTableBody element not found."
        );

        return;

    }


    tableBody.innerHTML = "";


    /*
     * Student count
     */

    const studentCount =
        document.getElementById(
            "studentCount"
        );


    if (studentCount) {

        studentCount.textContent =
            `${filteredStudents.length} ${
                filteredStudents.length === 1
                    ? "student"
                    : "students"
            }`;

    }


    /*
     * Empty state
     */

    if (
        filteredStudents.length === 0
    ) {

        tableBody.innerHTML = `
            <tr>
                <td colspan="8">
                    No students match the selected filters.
                </td>
            </tr>
        `;

        return;

    }


    /*
     * Render each student
     */

    filteredStudents.forEach(
        (student) => {

            const row =
                document.createElement(
                    "tr"
                );


            /*
             * Find original index.
             *
             * This is important because
             * View Result uses the original
             * student array.
             */

            const studentIndex =
                students.indexOf(
                    student
                );


            const rank =
                studentIndex >= 0
                    ? studentIndex + 1
                    : "-";


            const name =
                student?.name || "-";


            const prn =
                student?.prn || "-";


            const semesters =
                getSemesterDisplay(
                    student
                );


            const sgpa =
                getSGPADisplay(
                    student
                );


            const result =
                String(
                    student?.result ||
                    "UNKNOWN"
                ).toUpperCase();


            const backlogs =
                Number(
                    student?.backlogs || 0
                );


            /*
             * Result badge
             */

            let resultClass =
                "unknown";


            if (
                result === "PASS"
            ) {

                resultClass =
                    "pass";

            } else if (
                result === "FAIL"
            ) {

                resultClass =
                    "fail";

            }


            /*
             * Create row
             */

            row.innerHTML = `

                <td class="rank-cell">
                    ${rank}
                </td>


                <td class="student-name-cell">
                    ${escapeHTML(name)}
                </td>


                <td>
                    ${escapeHTML(prn)}
                </td>


                <td>
                    ${semesters}
                </td>


                <td>
                    ${sgpa}
                </td>


                <td>

                    <span class="
                        result
                        ${resultClass}
                    ">
                        ${escapeHTML(result)}
                    </span>

                </td>


                <td>
                    ${backlogs}
                </td>


                <td>

                    <button
                        type="button"
                        class="view-btn"
                        onclick="openStudentResult(${studentIndex})"
                    >
                        View Result
                    </button>

                </td>

            `;


            tableBody.appendChild(
                row
            );

        }
    );

}


/* =========================================================
   SEMESTER DISPLAY
========================================================= */

function getSemesterDisplay(
    student
) {

    const semesters =
        student?.semesters;


    if (
        !semesters ||
        typeof semesters !== "object"
    ) {

        return "-";

    }


    const semesterNumbers =
        Object.keys(
            semesters
        ).sort(
            (a, b) =>
                Number(a) -
                Number(b)
        );


    if (
        semesterNumbers.length === 0
    ) {

        return "-";

    }


    return semesterNumbers
        .map(
            semester =>
                `Sem ${escapeHTML(semester)}`
        )
        .join(", ");

}


/* =========================================================
   SGPA DISPLAY
========================================================= */

function getSGPADisplay(
    student
) {

    const semesters =
        student?.semesters;


    if (
        !semesters ||
        typeof semesters !== "object"
    ) {

        /*
         * Try overall SGPA as fallback
         */

        const overall =
            getOverallSGPA(
                student
            );


        return overall !== null
            ? overall.toFixed(2)
            : "-";

    }


    const semesterNumbers =
        Object.keys(
            semesters
        ).sort(
            (a, b) =>
                Number(a) -
                Number(b)
        );


    const values = [];


    semesterNumbers.forEach(
        semester => {

            const semesterData =
                semesters[
                    semester
                ];


            if (
                semesterData &&
                semesterData.sgpa !== null &&
                semesterData.sgpa !== undefined
            ) {

                const value =
                    Number(
                        semesterData.sgpa
                    );


                if (
                    !Number.isNaN(value)
                ) {

                    values.push(
                        value.toFixed(2)
                    );

                }

            }

        }
    );


    if (
        values.length === 0
    ) {

        const overall =
            getOverallSGPA(
                student
            );


        return overall !== null
            ? overall.toFixed(2)
            : "-";

    }


    if (
        values.length === 1
    ) {

        return values[0];

    }


    return values.join(
        " / "
    );

}


/* =========================================================
   GET OVERALL SGPA
========================================================= */

function getOverallSGPA(
    student
) {

    const value =
        Number(
            student?.overall_sgpa
        );


    if (
        Number.isNaN(value) ||
        value <= 0
    ) {

        return null;

    }


    return value;

}


/* =========================================================
   POPULATE SEMESTER FILTER
========================================================= */

function populateSemesterFilter() {

    const select =
        document.getElementById(
            "semesterFilter"
        );


    if (!select) {

        return;

    }


    const semesters =
        new Set();


    students.forEach(
        student => {

            if (
                student?.semesters &&
                typeof student.semesters === "object"
            ) {

                Object.keys(
                    student.semesters
                ).forEach(
                    semester => {

                        semesters.add(
                            semester
                        );

                    }
                );

            }

        }
    );


    const sortedSemesters =
        [...semesters].sort(
            (a, b) =>
                Number(a) -
                Number(b)
        );


    select.innerHTML = `
        <option value="ALL">
            All Semesters
        </option>
    `;


    sortedSemesters.forEach(
        semester => {

            const option =
                document.createElement(
                    "option"
                );


            option.value =
                semester;


            option.textContent =
                `Semester ${semester}`;


            select.appendChild(
                option
            );

        }
    );

}


/* =========================================================
   APPLY FILTERS
========================================================= */

function applyFilters() {

    const searchInput =
        document.getElementById(
            "studentSearch"
        );


    const resultFilter =
        document.getElementById(
            "resultFilter"
        );


    const semesterFilter =
        document.getElementById(
            "semesterFilter"
        );


    const search =
        (
            searchInput?.value ||
            ""
        )
            .trim()
            .toLowerCase();


    const result =
        resultFilter?.value ||
        "ALL";


    const semester =
        semesterFilter?.value ||
        "ALL";


    filteredStudents =
        students.filter(
            student => {

                /*
                 * SEARCH
                 */

                const name =
                    String(
                        student?.name ||
                        ""
                    ).toLowerCase();


                const prn =
                    String(
                        student?.prn ||
                        ""
                    ).toLowerCase();


                const seatNo =
                    String(
                        student?.seat_no ||
                        student?.seat ||
                        ""
                    ).toLowerCase();


                const matchesSearch =
                    !search ||
                    name.includes(search) ||
                    prn.includes(search) ||
                    seatNo.includes(search);


                if (
                    !matchesSearch
                ) {

                    return false;

                }


                /*
                 * RESULT FILTER
                 */

                const studentResult =
                    String(
                        student?.result ||
                        "UNKNOWN"
                    ).toUpperCase();


                if (
                    result !== "ALL" &&
                    studentResult !== result
                ) {

                    return false;

                }


                /*
                 * SEMESTER FILTER
                 */

                if (
                    semester !== "ALL"
                ) {

                    const studentSemesters =
                        student?.semesters;


                    if (
                        !studentSemesters ||
                        typeof studentSemesters !== "object" ||
                        !Object.prototype.hasOwnProperty.call(
                            studentSemesters,
                            semester
                        )
                    ) {

                        return false;

                    }

                }


                return true;

            }
        );


    renderStudents();

}


/* =========================================================
   FILTER EVENTS
========================================================= */

function setupFilters() {

    const searchInput =
        document.getElementById(
            "studentSearch"
        );


    const resultFilter =
        document.getElementById(
            "resultFilter"
        );


    const semesterFilter =
        document.getElementById(
            "semesterFilter"
        );


    const clearFilters =
        document.getElementById(
            "clearFilters"
        );


    /*
     * Search
     */

    if (searchInput) {

        searchInput.addEventListener(
            "input",
            applyFilters
        );

    }


    /*
     * Result
     */

    if (resultFilter) {

        resultFilter.addEventListener(
            "change",
            applyFilters
        );

    }


    /*
     * Semester
     */

    if (semesterFilter) {

        semesterFilter.addEventListener(
            "change",
            applyFilters
        );

    }


    /*
     * Clear
     */

    if (clearFilters) {

        clearFilters.addEventListener(
            "click",
            () => {

                if (searchInput) {

                    searchInput.value =
                        "";

                }


                if (resultFilter) {

                    resultFilter.value =
                        "ALL";

                }


                if (semesterFilter) {

                    semesterFilter.value =
                        "ALL";

                }


                filteredStudents =
                    [...students];


                renderStudents();

            }
        );

    }

}


/* =========================================================
   ANALYTICS TOGGLE
========================================================= */

function setupAnalyticsToggle() {

    const toggle =
        document.getElementById(
            "analyticsToggle"
        );


    const content =
        document.getElementById(
            "analyticsContent"
        );


    if (
        !toggle ||
        !content
    ) {

        return;

    }


    toggle.addEventListener(
        "click",
        function () {

            const isOpening =
                !content.classList.contains(
                    "active"
                );


            toggle.classList.toggle(
                "active"
            );


            content.classList.toggle(
                "active"
            );


            /*
             * IMPORTANT:
             *
             * Charts are rendered only
             * after analytics becomes visible.
             *
             * Chart.js cannot calculate
             * correct dimensions reliably
             * when canvas parent is display:none.
             */

            if (isOpening) {

                requestAnimationFrame(
                    () => {

                        try {

                            renderPerformanceCharts();

                            updateAnalyticsSummary();

                        } catch (error) {

                            console.error(
                                "Analytics rendering error:",
                                error
                            );

                        }

                    }
                );

            }

        }
    );

}


/* =========================================================
   RENDER ALL PERFORMANCE CHARTS
========================================================= */

function renderPerformanceCharts() {

    /*
     * Check Chart.js
     */

    if (
        typeof Chart === "undefined"
    ) {

        console.error(
            "Chart.js is not loaded."
        );

        return;

    }


    /*
     * Check data
     */

    if (
        !Array.isArray(students) ||
        students.length === 0
    ) {

        return;

    }


    /*
     * Render all charts
     */

    renderResultChart();

    renderSGPAChart();

    renderGradeChart();

    renderSemesterChart();

}


/* =========================================================
   DESTROY OLD CHART SAFELY
========================================================= */

function destroyChart(
    chartInstance
) {

    if (
        chartInstance &&
        typeof chartInstance.destroy === "function"
    ) {

        chartInstance.destroy();

    }

}


/* =========================================================
   RESULT CHART
========================================================= */

function renderResultChart() {

    const canvas =
        document.getElementById(
            "resultChart"
        );


    if (!canvas) {

        return;

    }


    destroyChart(
        resultChartInstance
    );


    let passed = 0;

    let failed = 0;


    students.forEach(
        student => {

            const result =
                String(
                    student?.result ||
                    "UNKNOWN"
                ).toUpperCase();


            if (
                result === "PASS"
            ) {

                passed++;

            } else if (
                result === "FAIL"
            ) {

                failed++;

            }

        }
    );


    const total =
        passed + failed;


    resultChartInstance =
        new Chart(
            canvas,
            {

                type: "doughnut",

                data: {

                    labels: [
                        "PASS",
                        "FAIL"
                    ],

                    datasets: [
                        {

                            data: [
                                passed,
                                failed
                            ],

                            borderWidth: 2

                        }
                    ]

                },

                options: {

                    responsive: true,

                    maintainAspectRatio: false,

                    cutout: "65%",

                    plugins: {

                        legend: {

                            position: "bottom"

                        },

                        tooltip: {

                            callbacks: {

                                label:
                                    function (
                                        context
                                    ) {

                                        const value =
                                            Number(
                                                context.raw || 0
                                            );


                                        const percentage =
                                            total > 0
                                                ? (
                                                    value /
                                                    total
                                                ) *
                                                100
                                                : 0;


                                        return (
                                            `${context.label}: ` +
                                            `${value} ` +
                                            `(${percentage.toFixed(1)}%)`
                                        );

                                    }

                            }

                        }

                    }

                }

            }
        );

}


/* =========================================================
   SGPA CHART
========================================================= */

function renderSGPAChart() {

    const canvas =
        document.getElementById(
            "sgpaChart"
        );


    if (!canvas) {

        return;

    }


    destroyChart(
        sgpaChartInstance
    );


    /*
     * Only students having SGPA
     */

    const chartStudents =
        students
            .map(
                student => {

                    return {

                        student,

                        sgpa:
                            getOverallSGPA(
                                student
                            )

                    };

                }
            )
            .filter(
                item =>
                    item.sgpa !== null
            )
            .sort(
                (a, b) =>
                    b.sgpa -
                    a.sgpa
            );


    const labels =
        chartStudents.map(
            item =>
                truncateName(
                    item.student?.name ||
                    "Student",
                    18
                )
        );


    const values =
        chartStudents.map(
            item =>
                item.sgpa
        );


    sgpaChartInstance =
        new Chart(
            canvas,
            {

                type: "bar",

                data: {

                    labels,

                    datasets: [
                        {

                            label:
                                "Overall SGPA",

                            data:
                                values,

                            borderWidth: 1,

                            borderRadius: 6

                        }
                    ]

                },

                options: {

                    responsive: true,

                    maintainAspectRatio: false,

                    scales: {

                        y: {

                            beginAtZero: true,

                            min: 0,

                            max: 10,

                            ticks: {

                                stepSize: 1

                            },

                            title: {

                                display: true,

                                text:
                                    "SGPA"

                            }

                        },

                        x: {

                            ticks: {

                                maxRotation: 45,

                                minRotation: 45

                            }

                        }

                    },

                    plugins: {

                        legend: {

                            display: false

                        },

                        tooltip: {

                            callbacks: {

                                label:
                                    function (
                                        context
                                    ) {

                                        return (
                                            `SGPA: ` +
                                            `${Number(
                                                context.raw
                                            ).toFixed(2)}`
                                        );

                                    }

                            }

                        }

                    }

                }

            }
        );

}


/* =========================================================
   GRADE CHART
========================================================= */

function renderGradeChart() {

    const canvas =
        document.getElementById(
            "gradeChart"
        );


    if (!canvas) {

        return;

    }


    destroyChart(
        gradeChartInstance
    );


    const gradeOrder = [

        "O",

        "A+",

        "A",

        "B+",

        "B",

        "C+",

        "C",

        "D",

        "F"

    ];


    const gradeCounts = {};


    gradeOrder.forEach(
        grade => {

            gradeCounts[grade] =
                0;

        }
    );


    /*
     * Count subject grades
     */

    students.forEach(
        student => {

            const subjects =
                Array.isArray(
                    student?.subjects
                )
                    ? student.subjects
                    : [];


            subjects.forEach(
                subject => {

                    let grade =
                        String(
                            subject?.grade ||
                            ""
                        )
                            .trim()
                            .toUpperCase();


                    /*
                     * Normalize possible
                     * variations.
                     */

                    if (
                        grade === "A PLUS"
                    ) {

                        grade = "A+";

                    }


                    if (
                        grade === "B PLUS"
                    ) {

                        grade = "B+";

                    }


                    if (
                        grade === "C PLUS"
                    ) {

                        grade = "C+";

                    }


                    if (
                        Object.prototype.hasOwnProperty.call(
                            gradeCounts,
                            grade
                        )
                    ) {

                        gradeCounts[
                            grade
                        ]++;

                    }

                }
            );

        }
    );


    const values =
        gradeOrder.map(
            grade =>
                gradeCounts[grade]
        );


    gradeChartInstance =
        new Chart(
            canvas,
            {

                type: "bar",

                data: {

                    labels:
                        gradeOrder,

                    datasets: [
                        {

                            label:
                                "Number of Subjects",

                            data:
                                values,

                            borderWidth: 1,

                            borderRadius: 6

                        }
                    ]

                },

                options: {

                    responsive: true,

                    maintainAspectRatio: false,

                    scales: {

                        y: {

                            beginAtZero: true,

                            ticks: {

                                precision: 0

                            },

                            title: {

                                display: true,

                                text:
                                    "Subjects"

                            }

                        }

                    },

                    plugins: {

                        legend: {

                            display: false

                        }

                    }

                }

            }
        );

}


/* =========================================================
   SEMESTER PERFORMANCE CHART
========================================================= */

function renderSemesterChart() {

    const canvas =
        document.getElementById(
            "semesterChart"
        );


    if (!canvas) {

        return;

    }


    destroyChart(
        semesterChartInstance
    );


    /*
     * semesterValues:
     *
     * {
     *   "1": [8.5, 9.1],
     *   "2": [8.2, 8.7]
     * }
     */

    const semesterValues = {};


    students.forEach(
        student => {

            const semesters =
                student?.semesters;


            if (
                !semesters ||
                typeof semesters !== "object"
            ) {

                return;

            }


            Object.keys(
                semesters
            ).forEach(
                semester => {

                    const data =
                        semesters[
                            semester
                        ];


                    if (
                        !data
                    ) {

                        return;

                    }


                    const sgpa =
                        Number(
                            data.sgpa
                        );


                    if (
                        Number.isNaN(sgpa) ||
                        sgpa <= 0
                    ) {

                        return;

                    }


                    if (
                        !semesterValues[
                            semester
                        ]
                    ) {

                        semesterValues[
                            semester
                        ] = [];

                    }


                    semesterValues[
                        semester
                    ].push(
                        sgpa
                    );

                }
            );

        }
    );


    const semesterNumbers =
        Object.keys(
            semesterValues
        ).sort(
            (a, b) =>
                Number(a) -
                Number(b)
        );


    const labels =
        semesterNumbers.map(
            semester =>
                `Semester ${semester}`
        );


    const values =
        semesterNumbers.map(
            semester => {

                const list =
                    semesterValues[
                        semester
                    ];


                if (
                    !list ||
                    list.length === 0
                ) {

                    return 0;

                }


                const average =
                    list.reduce(
                        (
                            sum,
                            value
                        ) =>
                            sum + value,
                        0
                    ) /
                    list.length;


                return Number(
                    average.toFixed(2)
                );

            }
        );


    semesterChartInstance =
        new Chart(
            canvas,
            {

                type: "line",

                data: {

                    labels,

                    datasets: [
                        {

                            label:
                                "Average SGPA",

                            data:
                                values,

                            borderWidth: 3,

                            tension: 0.3,

                            fill: false,

                            pointRadius: 5,

                            pointHoverRadius: 7

                        }
                    ]

                },

                options: {

                    responsive: true,

                    maintainAspectRatio: false,

                    scales: {

                        y: {

                            beginAtZero: true,

                            min: 0,

                            max: 10,

                            ticks: {

                                stepSize: 1

                            },

                            title: {

                                display: true,

                                text:
                                    "Average SGPA"

                            }

                        }

                    },

                    plugins: {

                        legend: {

                            display: true,

                            position: "bottom"

                        },

                        tooltip: {

                            callbacks: {

                                label:
                                    function (
                                        context
                                    ) {

                                        return (
                                            `Average SGPA: ` +
                                            `${Number(
                                                context.raw
                                            ).toFixed(2)}`
                                        );

                                    }

                            }

                        }

                    }

                }

            }
        );

}


/* =========================================================
   ANALYTICS SUMMARY
========================================================= */

function updateAnalyticsSummary() {

    if (
        !Array.isArray(students)
    ) {

        return;

    }


    const total =
        students.length;


    let passed = 0;

    let failed = 0;

    let totalBacklogs = 0;


    const sgpas = [];


    students.forEach(
        student => {

            const result =
                String(
                    student?.result ||
                    "UNKNOWN"
                ).toUpperCase();


            if (
                result === "PASS"
            ) {

                passed++;

            }


            if (
                result === "FAIL"
            ) {

                failed++;

            }


            totalBacklogs +=
                Number(
                    student?.backlogs ||
                    0
                );


            const sgpa =
                getOverallSGPA(
                    student
                );


            if (
                sgpa !== null
            ) {

                sgpas.push(
                    sgpa
                );

            }

        }
    );


    const passPercentage =
        total > 0
            ? (
                passed /
                total
            ) *
            100
            : 0;


    const failPercentage =
        total > 0
            ? (
                failed /
                total
            ) *
            100
            : 0;


    const averageSGPA =
        sgpas.length > 0
            ? sgpas.reduce(
                (
                    sum,
                    value
                ) =>
                    sum + value,
                0
            ) /
            sgpas.length
            : null;


    const highestSGPA =
        sgpas.length > 0
            ? Math.max(
                ...sgpas
            )
            : null;


    /*
     * Update elements
     */

    const passElement =
        document.getElementById(
            "analyticsPassPercentage"
        );


    const failElement =
        document.getElementById(
            "analyticsFailPercentage"
        );


    const averageElement =
        document.getElementById(
            "analyticsAverageSGPA"
        );


    const highestElement =
        document.getElementById(
            "analyticsHighestSGPA"
        );


    const backlogElement =
        document.getElementById(
            "analyticsBacklogs"
        );


    if (passElement) {

        passElement.textContent =
            `${passPercentage.toFixed(1)}%`;

    }


    if (failElement) {

        failElement.textContent =
            `${failPercentage.toFixed(1)}%`;

    }


    if (averageElement) {

        averageElement.textContent =
            averageSGPA !== null
                ? averageSGPA.toFixed(2)
                : "0.00";

    }


    if (highestElement) {

        highestElement.textContent =
            highestSGPA !== null
                ? highestSGPA.toFixed(2)
                : "0.00";

    }


    if (backlogElement) {

        backlogElement.textContent =
            totalBacklogs;

    }

}


/* =========================================================
   OPEN STUDENT RESULT
========================================================= */

function openStudentResult(index) {

    const student = students[index];

    if (!student) {

        alert(
            "Student information not available."
        );

        return;

    }


    /* =====================================================
       SAVE SELECTED STUDENT
    ===================================================== */

    selectedStudent = student;

    window.selectedSPPUStudent = student;


    /* =====================================================
       BASIC INFORMATION
    ===================================================== */

    const seatNo =
        student?.seat_no ||
        student?.seat ||
        "-";


    const motherName =
        student?.mother_name ||
        student?.mother ||
        "-";


    const course =
        student?.course ||
        "B.Sc. Computer Science";


    const result =
        String(
            student?.result ||
            "UNKNOWN"
        ).toUpperCase();


    const backlogs =
        Number(
            student?.backlogs ||
            0
        );


    const overallSGPA =
        getOverallSGPA(
            student
        );


    /* =====================================================
       RESULT CLASS
    ===================================================== */

    let resultClass =
        "unknown";


    if (
        result === "PASS"
    ) {

        resultClass =
            "pass";

    } else if (
        result === "FAIL"
    ) {

        resultClass =
            "fail";

    }


    /* =====================================================
       SEMESTER DATA
    ===================================================== */

    let semesterHTML = "";

    const semesters =
        student?.semesters;


    if (
        semesters &&
        typeof semesters === "object"
    ) {

        const semesterNumbers =
            Object.keys(
                semesters
            ).sort(
                (a, b) =>
                    Number(a) -
                    Number(b)
            );


        semesterNumbers.forEach(
            semester => {

                const data =
                    semesters[
                        semester
                    ];


                if (!data) {

                    return;

                }


                const sgpa =
                    data.sgpa !== null &&
                    data.sgpa !== undefined
                        ? Number(
                            data.sgpa
                        ).toFixed(2)
                        : "-";


                const credits =
                    data.credits !== null &&
                    data.credits !== undefined
                        ? data.credits
                        : "-";


                const gradePoints =
                    data.grade_points !== null &&
                    data.grade_points !== undefined
                        ? data.grade_points
                        : "-";


                const semesterResult =
                    String(
                        data.result ||
                        "UNKNOWN"
                    ).toUpperCase();


                const semesterBacklogs =
                    Number(
                        data.backlogs ||
                        0
                    );


                let semesterClass =
                    "unknown";


                if (
                    semesterResult === "PASS"
                ) {

                    semesterClass =
                        "pass";

                } else if (
                    semesterResult === "FAIL"
                ) {

                    semesterClass =
                        "fail";

                }


                semesterHTML += `

                    <div
                        class="result-semester-card"
                    >

                        <div
                            class="result-semester-title"
                        >

                            <strong>

                                Semester
                                ${escapeHTML(
                                    semester
                                )}

                            </strong>


                            <span
                                class="
                                    result
                                    ${semesterClass}
                                "
                            >

                                ${escapeHTML(
                                    semesterResult
                                )}

                            </span>

                        </div>


                        <div
                            class="result-semester-stats"
                        >

                            <div>

                                <span>
                                    SGPA
                                </span>

                                <strong>
                                    ${sgpa}
                                </strong>

                            </div>


                            <div>

                                <span>
                                    Credits
                                </span>

                                <strong>
                                    ${escapeHTML(
                                        credits
                                    )}
                                </strong>

                            </div>


                            <div>

                                <span>
                                    Grade Points
                                </span>

                                <strong>
                                    ${escapeHTML(
                                        gradePoints
                                    )}
                                </strong>

                            </div>


                            <div>

                                <span>
                                    Backlogs
                                </span>

                                <strong>
                                    ${semesterBacklogs}
                                </strong>

                            </div>

                        </div>

                    </div>

                `;

            }
        );

    }


    if (
        !semesterHTML
    ) {

        semesterHTML = `

            <div class="result-empty">

                Semester information not available.

            </div>

        `;

    }


    /* =====================================================
       SUBJECT DATA
    ===================================================== */

    let subjectsHTML = "";


    const subjects =
        Array.isArray(
            student?.subjects
        )
            ? student.subjects
            : [];


    if (
        subjects.length > 0
    ) {

        subjects.forEach(
            (
                subject,
                subjectIndex
            ) => {

                const code =
                    subject?.subject_code ||
                    "-";


                const grade =
                    subject?.grade ||
                    "-";


                const credit =
                    subject?.credit !== null &&
                    subject?.credit !== undefined
                        ? subject.credit
                        : "-";


                const failed =
                    Boolean(
                        subject?.failed
                    );


                const status =
                    failed
                        ? "FAIL"
                        : "PASS";


                subjectsHTML += `

                    <tr>

                        <td>
                            ${subjectIndex + 1}
                        </td>


                        <td>

                            <strong>
                                ${escapeHTML(
                                    code
                                )}
                            </strong>

                        </td>


                        <td>
                            ${escapeHTML(
                                grade
                            )}
                        </td>


                        <td>
                            ${escapeHTML(
                                credit
                            )}
                        </td>


                        <td>

                            <span
                                class="
                                    subject-status
                                    ${
                                        failed
                                            ? "subject-fail"
                                            : "subject-pass"
                                    }
                                "
                            >

                                ${status}

                            </span>

                        </td>

                    </tr>

                `;

            }
        );

    } else {

        subjectsHTML = `

            <tr>

                <td
                    colspan="5"
                    class="result-empty"
                >

                    Subject information not available.

                </td>

            </tr>

        `;

    }


    /* =====================================================
       FAILED SUBJECTS
    ===================================================== */

    let failedSubjectsHTML = "";


    const failedSubjects =
        Array.isArray(
            student?.failed_subjects
        )
            ? student.failed_subjects
            : [];


    if (
        failedSubjects.length > 0
    ) {

        failedSubjectsHTML = `

            <div
                class="failed-subjects-box"
            >

                <div
                    class="failed-subjects-title"
                >

                    ⚠ Failed Subjects

                </div>


                <div
                    class="failed-subject-list"
                >

                    ${failedSubjects
                        .map(
                            subject =>
                                `
                                <span>
                                    ${escapeHTML(
                                        subject
                                    )}
                                </span>
                                `
                        )
                        .join("")
                    }

                </div>

            </div>

        `;

    }


    /* =====================================================
       GET / CREATE MODAL
    ===================================================== */

    let modal =
        document.getElementById(
            "sppuResultModal"
        );


    if (!modal) {

        modal =
            document.createElement(
                "div"
            );


        modal.id =
            "sppuResultModal";


        document.body.appendChild(
            modal
        );


        /*
         * Add modal CSS only once
         */

        addSPPUResultStyles();

    }


    /* =====================================================
       IMPORTANT FIX
       
       Every time user clicks "View Result",
       COMPLETE modal HTML is regenerated.

       This prevents previous student's
       semester / subject / result data
       from remaining visible.
    ===================================================== */

    modal.innerHTML = `

        <div class="sppu-modal-overlay">

            <div class="sppu-result-modal">


                <!-- CLOSE BUTTON -->

                <button
                    type="button"
                    class="sppu-close-btn"
                    onclick="closeSPPUResultModal()"
                    aria-label="Close"
                >

                    ×

                </button>


                <!-- HEADER -->

                <div class="sppu-modal-header">

                    <div class="sppu-icon">

                        🎓

                    </div>


                    <div>

                        <h2>

                            Student Result

                        </h2>


                        <p>

                            Detailed academic performance

                        </p>

                    </div>

                </div>


                <!-- STUDENT INFORMATION -->

                <div class="sppu-student-info">


                    <div
                        class="sppu-info-card"
                    >

                        <span>
                            Student
                        </span>


                        <strong>
                            ${escapeHTML(
                                student?.name ||
                                "-"
                            )}
                        </strong>

                    </div>


                    <div
                        class="sppu-info-card"
                    >

                        <span>
                            Course
                        </span>


                        <strong>
                            ${escapeHTML(
                                course
                            )}
                        </strong>

                    </div>


                    <div
                        class="sppu-info-card"
                    >

                        <span>
                            Seat Number
                        </span>


                        <strong>
                            ${escapeHTML(
                                seatNo
                            )}
                        </strong>

                    </div>


                    <div
                        class="sppu-info-card"
                    >

                        <span>
                            Mother Name
                        </span>


                        <strong>
                            ${escapeHTML(
                                motherName
                            )}
                        </strong>

                    </div>

                </div>


                <!-- RESULT SUMMARY -->

                <div
                    class="result-summary"
                >


                    <div>

                        <span>
                            Overall SGPA
                        </span>


                        <strong>

                            ${
                                overallSGPA !== null
                                    ? overallSGPA.toFixed(2)
                                    : "-"
                            }

                        </strong>

                    </div>


                    <div>

                        <span>
                            Result
                        </span>


                        <strong>

                            <span
                                class="
                                    result
                                    ${resultClass}
                                "
                            >

                                ${escapeHTML(
                                    result
                                )}

                            </span>

                        </strong>

                    </div>


                    <div>

                        <span>
                            Backlogs
                        </span>


                        <strong>

                            ${backlogs}

                        </strong>

                    </div>


                </div>


                <!-- SEMESTER PERFORMANCE -->

                <section
                    class="result-detail-section"
                >


                    <div
                        class="result-section-title"
                    >

                        <div>

                            <h3>

                                Semester Performance

                            </h3>


                            <p>

                                Semester-wise academic summary

                            </p>

                        </div>

                    </div>


                    <div
                        class="result-semester-list"
                    >

                        ${semesterHTML}

                    </div>


                </section>


                <!-- SUBJECT PERFORMANCE -->

                <section
                    class="result-detail-section"
                >


                    <div
                        class="result-section-title"
                    >

                        <div>

                            <h3>

                                Subject Performance

                            </h3>


                            <p>

                                Subject-wise grades and credits

                            </p>

                        </div>

                    </div>


                    <div
                        class="subject-table-wrapper"
                    >

                        <table
                            class="subject-table"
                        >

                            <thead>

                                <tr>

                                    <th>
                                        #
                                    </th>


                                    <th>
                                        Subject Code
                                    </th>


                                    <th>
                                        Grade
                                    </th>


                                    <th>
                                        Credit
                                    </th>


                                    <th>
                                        Status
                                    </th>

                                </tr>

                            </thead>


                            <tbody>

                                ${subjectsHTML}

                            </tbody>

                        </table>

                    </div>


                </section>


                <!-- FAILED SUBJECTS -->

                ${failedSubjectsHTML}


                <!-- OFFICIAL VERIFICATION -->

                <div
                    class="sppu-verification-box"
                >


                    <div
                        class="verification-icon"
                    >

                        🔐

                    </div>


                    <div>

                        <strong>

                            Official SPPU verification

                        </strong>


                        <p>

                            To verify this result with
                            the university, open the
                            official SPPU result portal.
                            CAPTCHA verification must be
                            completed manually on SPPU.

                        </p>

                    </div>


                </div>


                <!-- ACTION BUTTONS -->

                <div
                    class="sppu-modal-actions"
                >


                    <button
                        type="button"
                        class="sppu-secondary-btn"
                        onclick="closeSPPUResultModal()"
                    >

                        Close

                    </button>


                    <button
                        type="button"
                        class="sppu-primary-btn"
                        onclick="openOfficialSPPUResult()"
                    >

                        Open SPPU Result →

                    </button>


                </div>


                <!-- FOOTER -->

                <div
                    class="sppu-footer"
                >

                    🔒

                    Result analysis is based on
                    the uploaded PDF.

                </div>


            </div>

        </div>

    `;


    /* =====================================================
       SHOW MODAL
    ===================================================== */

    modal.style.display =
        "flex";


    document.body.style.overflow =
        "hidden";

}


    



/* =========================================================
   CLOSE RESULT MODAL
========================================================= */

function closeSPPUResultModal() {

    const modal =
        document.getElementById(
            "sppuResultModal"
        );


    if (modal) {

        modal.style.display =
            "none";

    }


    document.body.style.overflow =
        "";

}


/* =========================================================
   OPEN OFFICIAL SPPU RESULT
========================================================= */

function openOfficialSPPUResult() {

    const student =
        window.selectedSPPUStudent;


    if (!student) {

        alert(
            "Student information not available."
        );

        return;

    }


    /*
     * Official SPPU result portal.
     *
     * CAPTCHA is handled manually
     * by the user on the official site.
     *
     * Do not hard-code the test PDF's
     * session/year here.
     */

    const officialURL =
        "https://onlineresults.unipune.ac.in/SPPU";


    window.open(
        officialURL,
        "_blank",
        "noopener,noreferrer"
    );

}


/* =========================================================
   MODAL STYLES
========================================================= */

function addSPPUResultStyles() {

    if (
        document.getElementById(
            "sppuResultModalStyles"
        )
    ) {

        return;

    }


    const style =
        document.createElement(
            "style"
        );


    style.id =
        "sppuResultModalStyles";


    style.textContent = `

        /* =====================================================
           MODAL OVERLAY
        ===================================================== */

        .sppu-modal-overlay {

            position: fixed;

            inset: 0;

            display: flex;

            align-items: center;

            justify-content: center;

            padding: 24px;

            background:
                rgba(15, 23, 42, 0.62);

            backdrop-filter:
                blur(7px);

            z-index: 99999;

            animation:
                sppuFadeIn 0.2s ease;

        }


        /* =====================================================
           MODAL
        ===================================================== */

        .sppu-result-modal {

            position: relative;

            width:
                min(850px, 100%);

            max-height:
                92vh;

            overflow-y:
                auto;

            padding:
                28px;

            background:
                #ffffff;

            border-radius:
                22px;

            box-shadow:
                0 25px 70px
                rgba(15, 23, 42, 0.25);

            animation:
                sppuSlideUp 0.25s ease;

        }


        /* =====================================================
           CLOSE BUTTON
        ===================================================== */

        .sppu-close-btn {

            position: absolute;

            top: 18px;

            right: 20px;

            width: 36px;

            height: 36px;

            display: flex;

            align-items: center;

            justify-content: center;

            border: none;

            border-radius: 50%;

            background:
                #f1f5f9;

            color:
                #475569;

            font-size: 24px;

            cursor: pointer;

        }


        .sppu-close-btn:hover {

            background:
                #e2e8f0;

        }


        /* =====================================================
           HEADER
        ===================================================== */

        .sppu-modal-header {

            display: flex;

            align-items: center;

            gap: 15px;

            padding-right: 40px;

            margin-bottom: 24px;

        }


        .sppu-icon {

            width: 52px;

            height: 52px;

            display: flex;

            align-items: center;

            justify-content: center;

            border-radius: 15px;

            background:
                #eef2ff;

            font-size: 25px;

        }


        .sppu-modal-header h2 {

            margin: 0;

            color:
                #172554;

            font-size: 22px;

        }


        .sppu-modal-header p {

            margin:
                5px 0 0;

            color:
                #64748b;

            font-size: 13px;

            line-height: 1.5;

        }


        /* =====================================================
           STUDENT INFO
        ===================================================== */

        .sppu-student-info {

            display: grid;

            grid-template-columns:
                repeat(
                    2,
                    minmax(0, 1fr)
                );

            gap: 12px;

            margin-bottom: 20px;

        }


        .sppu-info-card {

            padding:
                14px 16px;

            background:
                #f8fafc;

            border:
                1px solid #e2e8f0;

            border-radius:
                13px;

        }


        .sppu-info-card span {

            display: block;

            margin-bottom: 5px;

            color:
                #64748b;

            font-size: 11px;

        }


        .sppu-info-card strong {

            display: block;

            color:
                #172554;

            font-size: 14px;

            word-break:
                break-word;

        }


        /* =====================================================
           RESULT SUMMARY
        ===================================================== */

        .result-summary {

            display: grid;

            grid-template-columns:
                repeat(
                    3,
                    minmax(0, 1fr)
                );

            gap: 12px;

            margin-bottom: 24px;

        }


        .result-summary > div {

            padding:
                16px;

            background:
                #f8fafc;

            border:
                1px solid #e2e8f0;

            border-radius:
                13px;

        }


        .result-summary span {

            display: block;

            margin-bottom: 5px;

            color:
                #64748b;

            font-size: 11px;

        }


        .result-summary strong {

            display: block;

            color:
                #172554;

            font-size: 20px;

        }


        /* =====================================================
           DETAIL SECTION
        ===================================================== */

        .result-detail-section {

            margin-top: 24px;

        }


        .result-section-title {

            margin-bottom: 14px;

        }


        .result-section-title h3 {

            margin: 0;

            color:
                #172033;

            font-size: 17px;

        }


        .result-section-title p {

            margin:
                4px 0 0;

            color:
                #64748b;

            font-size: 12px;

        }


        /* =====================================================
           SEMESTER CARDS
        ===================================================== */

        .result-semester-list {

            display: grid;

            gap: 12px;

        }


        .result-semester-card {

            padding:
                16px;

            background:
                #ffffff;

            border:
                1px solid #e2e8f0;

            border-radius:
                14px;

        }


        .result-semester-title {

            display: flex;

            align-items: center;

            justify-content: space-between;

            gap: 12px;

            margin-bottom: 14px;

        }


        .result-semester-title strong {

            color:
                #172033;

            font-size: 14px;

        }


        .result-semester-stats {

            display: grid;

            grid-template-columns:
                repeat(
                    4,
                    minmax(0, 1fr)
                );

            gap: 10px;

        }


        .result-semester-stats div {

            padding:
                10px;

            background:
                #f8fafc;

            border-radius:
                10px;

        }


        .result-semester-stats span {

            display: block;

            color:
                #64748b;

            font-size: 10px;

            margin-bottom: 4px;

        }


        .result-semester-stats strong {

            color:
                #172033;

            font-size: 14px;

        }


        /* =====================================================
           RESULT BADGES
        ===================================================== */

        .result {

            display: inline-flex;

            align-items: center;

            justify-content: center;

            padding:
                5px 10px;

            border-radius:
                999px;

            font-size: 11px;

            font-weight: 700;

        }


        .result.pass {

            background:
                #dcfce7;

            color:
                #166534;

        }


        .result.fail {

            background:
                #fee2e2;

            color:
                #991b1b;

        }


        .result.unknown {

            background:
                #f1f5f9;

            color:
                #475569;

        }


        /* =====================================================
           SUBJECT TABLE
        ===================================================== */

        .subject-table-wrapper {

            width: 100%;

            overflow-x: auto;

            border:
                1px solid #e2e8f0;

            border-radius:
                14px;

        }


        .subject-table {

            width: 100%;

            border-collapse:
                collapse;

            min-width:
                520px;

        }


        .subject-table th {

            padding:
                12px;

            background:
                #f8fafc;

            color:
                #475569;

            font-size: 11px;

            text-align: left;

        }


        .subject-table td {

            padding:
                12px;

            border-top:
                1px solid #e2e8f0;

            color:
                #334155;

            font-size: 12px;

        }


        .subject-status {

            display: inline-flex;

            padding:
                5px 9px;

            border-radius:
                999px;

            font-size: 10px;

            font-weight: 700;

        }


        .subject-pass {

            background:
                #dcfce7;

            color:
                #166534;

        }


        .subject-fail {

            background:
                #fee2e2;

            color:
                #991b1b;

        }


        /* =====================================================
           FAILED SUBJECTS
        ===================================================== */

        .failed-subjects-box {

            margin-top: 18px;

            padding: 16px;

            background:
                #fff7ed;

            border:
                1px solid #fed7aa;

            border-radius:
                14px;

        }


        .failed-subjects-title {

            margin-bottom: 10px;

            color:
                #9a3412;

            font-size: 13px;

            font-weight: 700;

        }


        .failed-subject-list {

            display: flex;

            flex-wrap: wrap;

            gap: 8px;

        }


        .failed-subject-list span {

            padding:
                6px 10px;

            background:
                #ffffff;

            border:
                1px solid #fed7aa;

            border-radius:
                999px;

            color:
                #9a3412;

            font-size: 11px;

        }


        /* =====================================================
           EMPTY
        ===================================================== */

        .result-empty {

            padding: 18px;

            color:
                #64748b;

            text-align: center;

        }


        /* =====================================================
           VERIFICATION
        ===================================================== */

        .sppu-verification-box {

            display: flex;

            gap: 13px;

            padding: 16px;

            margin-top: 20px;

            background:
                #f8fafc;

            border:
                1px solid #e2e8f0;

            border-radius:
                13px;

        }


        .verification-icon {

            width: 38px;

            height: 38px;

            display: flex;

            align-items: center;

            justify-content: center;

            flex-shrink: 0;

            border-radius: 10px;

            background:
                #eef2ff;

            font-size: 17px;

        }


        .sppu-verification-box strong {

            display: block;

            color:
                #172033;

            font-size: 13px;

            margin-bottom: 4px;

        }


        .sppu-verification-box p {

            margin: 0;

            color:
                #64748b;

            font-size: 12px;

            line-height: 1.5;

        }


        /* =====================================================
           ACTIONS
        ===================================================== */

        .sppu-modal-actions {

            display: flex;

            justify-content: flex-end;

            gap: 10px;

            margin-top: 22px;

        }


        .sppu-secondary-btn,
        .sppu-primary-btn {

            border: none;

            border-radius: 10px;

            padding:
                12px 18px;

            font-family: inherit;

            font-size: 13px;

            font-weight: 650;

            cursor: pointer;

        }


        .sppu-secondary-btn {

            background:
                #f1f5f9;

            color:
                #475569;

        }


        .sppu-secondary-btn:hover {

            background:
                #e2e8f0;

        }


        .sppu-primary-btn {

            background:
                #172554;

            color:
                #ffffff;

            box-shadow:
                0 6px 15px
                rgba(
                    23,
                    37,
                    84,
                    0.20
                );

        }


        .sppu-primary-btn:hover {

            background:
                #1e3a8a;

        }


        /* =====================================================
           FOOTER
        ===================================================== */

        .sppu-footer {

            display: flex;

            align-items: center;

            justify-content: center;

            gap: 5px;

            margin-top: 18px;

            padding-top: 15px;

            border-top:
                1px solid #e2e8f0;

            color:
                #64748b;

            font-size: 11px;

            text-align: center;

        }


        /* =====================================================
           ANIMATIONS
        ===================================================== */

        @keyframes sppuFadeIn {

            from {

                opacity: 0;

            }

            to {

                opacity: 1;

            }

        }


        @keyframes sppuSlideUp {

            from {

                opacity: 0;

                transform:
                    translateY(15px);

            }

            to {

                opacity: 1;

                transform:
                    translateY(0);

            }

        }


        /* =====================================================
           MOBILE
        ===================================================== */

        @media (max-width: 700px) {

            .sppu-modal-overlay {

                padding: 12px;

            }


            .sppu-result-modal {

                padding: 20px;

                border-radius: 18px;

            }


            .sppu-student-info {

                grid-template-columns:
                    1fr;

            }


            .result-summary {

                grid-template-columns:
                    1fr;

            }


            .result-semester-stats {

                grid-template-columns:
                    repeat(
                        2,
                        minmax(0, 1fr)
                    );

            }


            .sppu-modal-actions {

                flex-direction:
                    column-reverse;

            }


            .sppu-secondary-btn,
            .sppu-primary-btn {

                width: 100%;

            }

        }

    `;


    document.head.appendChild(
        style
    );

}


/* =========================================================
   CLOSE MODAL ON OUTSIDE CLICK
========================================================= */

document.addEventListener(
    "click",
    function (event) {

        const modal =
            document.getElementById(
                "sppuResultModal"
            );


        if (!modal) {

            return;

        }


        const overlay =
            modal.querySelector(
                ".sppu-modal-overlay"
            );


        if (
            overlay &&
            event.target === overlay
        ) {

            closeSPPUResultModal();

        }

    }
);


/* =========================================================
   ESCAPE KEY
========================================================= */

document.addEventListener(
    "keydown",
    function (event) {

        if (
            event.key === "Escape"
        ) {

            closeSPPUResultModal();

        }

    }
);


/* =========================================================
   DASHBOARD STATISTICS
========================================================= */

function updateStatistics() {

    const total =
        students.length;


    let passed = 0;

    let failed = 0;

    let totalBacklogs = 0;


    const sgpas = [];


    students.forEach(
        student => {

            const status =
                String(
                    student?.result ||
                    "UNKNOWN"
                ).toUpperCase();


            /*
             * PASS
             */

            if (
                status === "PASS"
            ) {

                passed++;

            }


            /*
             * FAIL
             */

            if (
                status === "FAIL"
            ) {

                failed++;

            }


            /*
             * BACKLOGS
             */

            totalBacklogs +=
                Number(
                    student?.backlogs ||
                    0
                );


            /*
             * SGPA
             */

            const overallSGPA =
                getOverallSGPA(
                    student
                );


            if (
                overallSGPA !== null
            ) {

                sgpas.push(
                    overallSGPA
                );

            }

        }
    );


    /*
     * Highest
     */

    const highestSGPA =
        sgpas.length > 0
            ? Math.max(
                ...sgpas
            )
            : null;


    /*
     * Average
     */

    const averageSGPA =
        sgpas.length > 0
            ? sgpas.reduce(
                (
                    sum,
                    value
                ) =>
                    sum + value,
                0
            ) /
            sgpas.length
            : null;


    /*
     * Elements
     */

    const totalElement =
        document.getElementById(
            "totalStudents"
        );


    const passedElement =
        document.getElementById(
            "passedStudents"
        );


    const failedElement =
        document.getElementById(
            "failedStudents"
        );


    const backlogElement =
        document.getElementById(
            "totalBacklogs"
        );


    const highestElement =
        document.getElementById(
            "highestSGPA"
        );


    const averageElement =
        document.getElementById(
            "averageSGPA"
        );


    /*
     * Total
     */

    if (totalElement) {

        totalElement.textContent =
            total;

    }


    /*
     * Passed
     */

    if (passedElement) {

        passedElement.textContent =
            passed;

    }


    /*
     * Failed
     */

    if (failedElement) {

        failedElement.textContent =
            failed;

    }


    /*
     * Backlogs
     */

    if (backlogElement) {

        backlogElement.textContent =
            totalBacklogs;

    }


    /*
     * Highest SGPA
     */

    if (highestElement) {

        highestElement.textContent =
            highestSGPA !== null
                ? highestSGPA.toFixed(2)
                : "-";

    }


    /*
     * Average SGPA
     */

    if (averageElement) {

        averageElement.textContent =
            averageSGPA !== null
                ? averageSGPA.toFixed(2)
                : "-";

    }

}


/* =========================================================
   UTILITY: ESCAPE HTML
========================================================= */

function escapeHTML(
    value
) {

    return String(
        value ?? ""
    )

        .replace(
            /&/g,
            "&amp;"
        )

        .replace(
            /</g,
            "&lt;"
        )

        .replace(
            />/g,
            "&gt;"
        )

        .replace(
            /"/g,
            "&quot;"
        )

        .replace(
            /'/g,
            "&#039;"
        );

}


/* =========================================================
   UTILITY: TRUNCATE NAME
========================================================= */

function truncateName(
    name,
    maxLength = 18
) {

    const text =
        String(
            name || "Student"
        );


    if (
        text.length <= maxLength
    ) {

        return text;

    }


    return (
        text.substring(
            0,
            maxLength - 3
        ) +
        "..."
    );

}


/* =========================================================
   WINDOW EXPORTS
========================================================= */

window.openStudentResult =
    openStudentResult;


window.closeSPPUResultModal =
    closeSPPUResultModal;


window.openOfficialSPPUResult =
    openOfficialSPPUResult;


window.applyFilters =
    applyFilters;


/* =========================================================
   START DASHBOARD
========================================================= */

setupAnalyticsToggle();

setupFilters();

loadResultData();