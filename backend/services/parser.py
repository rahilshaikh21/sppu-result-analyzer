import re


# ============================================================
# CLEAN TEXT
# ============================================================

def clean_text(text):
    if not text:
        return ""

    lines = []

    for line in text.splitlines():
        line = re.sub(r"\s+", " ", line).strip()

        if line:
            lines.append(line)

    return "\n".join(lines)


# ============================================================
# STUDENT HEADER
# ============================================================

def is_student_header(line):
    """
    Actual SPPU format:

    25737 INAMDAR SAYYED UMAID ABDUL HAMID SAIRA BANO M
    1101927469 3 F 25737
    """

    line = line.strip()

    pattern = (
        r"^\d{4,6}\s+"
        r".+\s+"
        r"[MF]\s+"
        r"\d{10}\s+"
        r"[1-8]\s+"
    )

    return bool(re.match(pattern, line))


# ============================================================
# PARSE STUDENT HEADER
# ============================================================

# ============================================================
# PARSE STUDENT HEADER
# ============================================================

def parse_student_header(line):

    line = re.sub(r"\s+", " ", line.strip())

    match = re.match(
        r"^(\d{4,6})\s+(.+?)\s+([MF])\s+(\d{10})\s+([1-8])\s+(.*)$",
        line
    )

    if not match:
        return None

    seat_no = match.group(1)
    name_mother = match.group(2).strip()
    gender = match.group(3)
    prn = match.group(4)
    semester = int(match.group(5))
    status_fields = match.group(6).strip()

    # --------------------------------------------------------
    # Separate Student Name and Mother Name
    #
    # SPPU PDF header places both names before Gender.
    #
    # Examples:
    #
    # TAMBOLI SUFIYAN JAVED YASMIN
    # -> Student: TAMBOLI SUFIYAN JAVED
    # -> Mother : YASMIN
    #
    # INAMDAR SAYYED UMAID ABDUL HAMID SAIRA BANO
    # -> Student: INAMDAR SAYYED UMAID ABDUL HAMID
    # -> Mother : SAIRA BANO
    # --------------------------------------------------------

    name_parts = name_mother.split()

    student_name = name_mother
    mother_name = ""

    if len(name_parts) >= 4:

        # Most records in this SPPU format have
        # mother's name as the final 1 or 2 words.
        #
        # Detect common 2-word mother names by checking
        # whether the final pair forms a likely name.
        #
        # For the current PDF, these are the observed
        # two-word mother names.

        two_word_mothers = {
            "SAIRA BANO"
        }

        last_two = " ".join(name_parts[-2:]).upper()

        if last_two in two_word_mothers:

            mother_name = " ".join(name_parts[-2:])
            student_name = " ".join(name_parts[:-2])

        else:

            mother_name = name_parts[-1]
            student_name = " ".join(name_parts[:-1])

    elif len(name_parts) == 3:

        # Example:
        # SURNAME STUDENT MOTHER

        mother_name = name_parts[-1]
        student_name = " ".join(name_parts[:-1])

    elif len(name_parts) == 2:

        student_name = name_parts[0]
        mother_name = name_parts[1]

    return {
        "seat_no": seat_no,
        "name": student_name,
        "mother_name": mother_name,
        "gender": gender,
        "prn": prn,
        "semester": semester,
        "status_fields": status_fields
    }


# ============================================================
# SGPA
# ============================================================

def extract_sgpa(text):

    match = re.search(
        r"SGPA\s*:\s*\((\d+)\)\s*([0-9]+(?:\.[0-9]+)?)",
        text,
        re.IGNORECASE
    )

    if not match:
        return None, None

    semester = int(match.group(1))
    sgpa = float(match.group(2))

    return semester, sgpa


# ============================================================
# TOTAL CREDITS
# ============================================================

def extract_total_credits(text):

    match = re.search(
        r"TOTAL\s+CREDITS\s*:\s*(\d+)",
        text,
        re.IGNORECASE
    )

    if not match:
        return None

    return int(match.group(1))


# ============================================================
# GRADE POINTS
# ============================================================

def extract_grade_points(text):

    match = re.search(
        r"GRADE\s+POINTS\s*:\s*(\d+)",
        text,
        re.IGNORECASE
    )

    if not match:
        return None

    return int(match.group(1))


# ============================================================
# SUBJECT LINE
# ============================================================

def is_subject_line(line):

    line = line.strip()

    return bool(
        re.match(
            r"^\d{5}\s*:",
            line
        )
    )


# ============================================================
# PARSE SUBJECT
# ============================================================

def parse_subject(line):
    line = re.sub(r"\s+", " ", line.strip())

    match = re.match(
        r"^(\d{5})\s*:\s*(.*)$",
        line
    )

    if not match:
        return None

    subject_code = match.group(1)
    values = match.group(2).strip()

    tokens = values.split()

    subject = {
        "subject_code": subject_code,

        # Original OCR tokens
        "raw_values": tokens,

        # Marks
        "internal_marks": None,
        "external_marks": None,
        "total_marks": None,

        # Academic data
        "grade": None,
        "credit": None,

        # Result
        "failed": False
    }

    # --------------------------------------------------------
    # Grade
    # --------------------------------------------------------

    grades = {
        "O",
        "A+",
        "A",
        "B+",
        "B",
        "C+",
        "C",
        "D",
        "F",
        "FF",
        "AB",
        "ABFF",
        "FF"
    }

    grade_index = None

    for index, token in enumerate(tokens):

        clean_token = token.upper().strip()

        if clean_token in grades:

            subject["grade"] = clean_token
            grade_index = index

            if clean_token in {
                "F",
                "FF",
                "AB",
                "ABFF"
            }:
                subject["failed"] = True

            break

    # --------------------------------------------------------
    # MARKS
    #
    # Normal SPPU pattern:
    #
    # 14 32 * 46 O 2
    #
    # Internal = 14
    # External = 32
    # Total = 46
    # Grade = O
    # Credit = 2
    #
    # Failed example:
    #
    # 13 AA * 13 F FF
    #
    # Internal = 13
    # External = AA
    # Total = 13
    # Grade = F
    # --------------------------------------------------------

    if grade_index is not None:

        mark_tokens = tokens[:grade_index]

        # Remove symbols such as:
        # *
        # $
        # #
        # and keep actual mark/AA tokens.

        cleaned_marks = []

        for token in mark_tokens:

            token = token.strip()

            if token in {
                "*",
                "$",
                "#"
            }:
                continue

            # Remove trailing symbols from OCR
            # Example:
            # 14$
            # 25#
            # 30*
            cleaned = re.sub(
                r"[*#$]+$",
                "",
                token
            )

            if cleaned:
                cleaned_marks.append(
                    cleaned
                )

        # ----------------------------------------------------
        # First value = Internal
        # Second value = External
        # Third value = Total
        # ----------------------------------------------------

        if len(cleaned_marks) >= 1:

            value = cleaned_marks[0]

            if re.fullmatch(
                r"\d+",
                value
            ):
                subject["internal_marks"] = int(value)

            elif value.upper() == "AA":
                subject["internal_marks"] = "AA"

        if len(cleaned_marks) >= 2:

            value = cleaned_marks[1]

            if re.fullmatch(
                r"\d+",
                value
            ):
                subject["external_marks"] = int(value)

            elif value.upper() == "AA":
                subject["external_marks"] = "AA"

        if len(cleaned_marks) >= 3:

            value = cleaned_marks[2]

            if re.fullmatch(
                r"\d+",
                value
            ):
                subject["total_marks"] = int(value)

            elif value.upper() == "AA":
                subject["total_marks"] = "AA"

    # --------------------------------------------------------
    # CREDIT
    #
    # Credit is normally the numeric value AFTER grade.
    #
    # Example:
    # 14 32 * 46 O 2
    #
    # Credit = 2
    #
    # Failed:
    # 13 AA * 13 F FF
    #
    # No credit is assigned because FF is the final token.
    # --------------------------------------------------------

    if grade_index is not None:

        after_grade = tokens[
            grade_index + 1:
        ]

        for token in after_grade:

            token = token.strip()

            if re.fullmatch(
                r"\d+(?:\.\d+)?",
                token
            ):

                value = float(token)

                if 0 < value <= 10:

                    if value.is_integer():
                        subject["credit"] = int(value)
                    else:
                        subject["credit"] = value

                    break

    return subject
# ============================================================
# RESULT STATUS
# ============================================================

def calculate_result_status(student):

    failed_subjects = []

    for subject in student.get("subjects", []):

        if subject.get("failed"):

            failed_subjects.append(
                subject.get("subject_code")
            )

    student["failed_subjects"] = failed_subjects
    student["backlogs"] = len(failed_subjects)

    if student["backlogs"] > 0:
        student["result"] = "FAIL"
    else:
        student["result"] = "PASS"

    return student


# ============================================================
# SPLIT STUDENTS
# ============================================================

def split_students(text):

    text = clean_text(text)

    lines = text.splitlines()

    blocks = []

    current_block = []

    for line in lines:

        # New student detected
        if is_student_header(line):

            if current_block:

                blocks.append(current_block)

            current_block = [line]

        else:

            if current_block:

                current_block.append(line)

    # Last student
    if current_block:
        blocks.append(current_block)

    return blocks


# ============================================================
# PARSE ONE STUDENT
# ============================================================

def parse_student_block(lines):

    if not lines:
        return None

    header = parse_student_header(
        lines[0]
    )

    if not header:
        return None

    student = {
        "seat_no": header["seat_no"],
        "name": header["name"],
        "mother_name": header["mother_name"],
        "gender": header["gender"],
        "prn": header["prn"],
        "semester": header["semester"],

        "sgpa": None,
        "credits": None,
        "grade_points": None,

        "subjects": [],

        "failed_subjects": [],
        "backlogs": 0,

        "result": "UNKNOWN",

        "result_page": None
    }

    block_text = "\n".join(lines)

    # --------------------------------------------------------
    # SGPA
    # --------------------------------------------------------

    semester, sgpa = extract_sgpa(
        block_text
    )

    if sgpa is not None:

        student["sgpa"] = sgpa

        if semester is not None:
            student["semester"] = semester

    # --------------------------------------------------------
    # Credits
    # --------------------------------------------------------

    student["credits"] = extract_total_credits(
        block_text
    )

    # --------------------------------------------------------
    # Grade Points
    # --------------------------------------------------------

    student["grade_points"] = extract_grade_points(
        block_text
    )

    # --------------------------------------------------------
    # Subjects
    # --------------------------------------------------------

    for line in lines:

        # Some PDF lines contain multiple subjects.
        # Example:
        #
        # 23121 : ... 23122 : ...
        #
        # So find ALL subject records.

        matches = re.findall(
            r"(\d{5})\s*:\s*(.*?)(?=\s+\d{5}\s*:|$)",
            line
        )

        for subject_code, values in matches:

            subject_line = (
                subject_code
                + " : "
                + values.strip()
            )

            subject = parse_subject(
                subject_line
            )

            if subject:
                student["subjects"].append(
                    subject
                )

    # --------------------------------------------------------
    # Result
    # --------------------------------------------------------

    calculate_result_status(
        student
    )

    return student


# ============================================================
# PARSE MULTIPLE STUDENTS
# ============================================================

def parse_multiple_students(text):

    if not text:
        return []

    blocks = split_students(
        text
    )

    students = []

    for block in blocks:

        student = parse_student_block(
            block
        )

        if student:
            students.append(
                student
            )

    return students


# ============================================================
# MERGE SAME STUDENT
# ============================================================

def merge_students(students):

    merged = {}

    for student in students:

        prn = student.get("prn")

        if not prn:
            continue

        if prn not in merged:

            merged[prn] = {
                "name": student.get("name", ""),
                "mother_name": student.get(
                    "mother_name",
                    ""
                ),

                "seat_no": student.get(
                    "seat_no",
                    ""
                ),

                "gender": student.get(
                    "gender",
                    ""
                ),

                "prn": prn,

                "semesters": {},

                "subjects": [],

                "result": "PASS",

                "backlogs": 0,

                "failed_subjects": [],

                "overall_sgpa": None,

                "total_credits": 0,

                "total_grade_points": 0,

                "result_pages": []
            }

        target = merged[prn]

        semester = student.get(
            "semester"
        )

        # ----------------------------------------------------
        # Semester data
        # ----------------------------------------------------

        if semester is not None:

            target["semesters"][
                str(semester)
            ] = {

                "semester": semester,

                "sgpa": student.get(
                    "sgpa"
                ),

                "credits": student.get(
                    "credits"
                ),

                "grade_points": student.get(
                    "grade_points"
                ),

                "result": student.get(
                    "result"
                ),

                "backlogs": student.get(
                    "backlogs",
                    0
                ),

                "failed_subjects": student.get(
                    "failed_subjects",
                    []
                ),

                "result_page": student.get(
                    "result_page"
                )
            }

        # ----------------------------------------------------
        # Subjects
        # ----------------------------------------------------

        target["subjects"].extend(
            student.get(
                "subjects",
                []
            )
        )

        # ----------------------------------------------------
        # Backlogs
        # ----------------------------------------------------

        target["backlogs"] += student.get(
            "backlogs",
            0
        )

        # ----------------------------------------------------
        # Failed subjects
        # ----------------------------------------------------

        target["failed_subjects"].extend(
            student.get(
                "failed_subjects",
                []
            )
        )

        # ----------------------------------------------------
        # Credits
        # ----------------------------------------------------

        credits = student.get(
            "credits"
        )

        if credits:
            target["total_credits"] += credits

        # ----------------------------------------------------
        # Grade points
        # ----------------------------------------------------

        grade_points = student.get(
            "grade_points"
        )

        if grade_points:
            target["total_grade_points"] += (
                grade_points
            )

        # ----------------------------------------------------
        # Result page
        # ----------------------------------------------------

        page = student.get(
            "result_page"
        )

        if (
            page is not None
            and page not in target["result_pages"]
        ):

            target["result_pages"].append(
                page
            )

        # ----------------------------------------------------
        # Overall result
        # ----------------------------------------------------

        if student.get(
            "result"
        ) == "FAIL":

            target["result"] = "FAIL"

    # ========================================================
    # FINAL CALCULATIONS
    # ========================================================

    final_students = list(
        merged.values()
    )

    for student in final_students:

        sgpas = []

        for semester_data in student[
            "semesters"
        ].values():

            sgpa = semester_data.get(
                "sgpa"
            )

            if sgpa is not None:
                sgpas.append(
                    float(sgpa)
                )

        if sgpas:

            student["overall_sgpa"] = round(
                sum(sgpas) / len(sgpas),
                2
            )

        # Remove duplicate failed subjects
        student[
            "failed_subjects"
        ] = list(
            dict.fromkeys(
                student[
                    "failed_subjects"
                ]
            )
        )

    return final_students