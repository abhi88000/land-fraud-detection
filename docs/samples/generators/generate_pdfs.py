"""
Generate realistic Indian land documents as PDF files for LandGuard testing.
Uses raw PDF writing - NO external libraries needed.
Run: python generate_pdfs.py
"""

import os, random
from datetime import datetime, timedelta


class SimplePDF:
    """Minimal PDF generator using raw PDF format. Zero dependencies."""

    def __init__(self):
        self.pages = []
        self.current_page_lines = []
        self.font_size = 11
        self.y = 760  # start near top
        self.margin_left = 60
        self.page_width = 595  # A4
        self.page_height = 842
        self.line_height = 14

    def set_font_size(self, size):
        self.font_size = size
        self.line_height = size + 3

    def _wrap_text(self, text, max_chars):
        """Word-wrap text to fit within max_chars per line."""
        words = text.split()
        lines = []
        current = ""
        for w in words:
            if current and len(current) + 1 + len(w) > max_chars:
                lines.append(current)
                current = w
            else:
                current = current + " " + w if current else w
        if current:
            lines.append(current)
        return lines if lines else [""]

    def _check_page_break(self, lines_needed=1):
        if self.y - (lines_needed * self.line_height) < 60:
            self.pages.append(self.current_page_lines)
            self.current_page_lines = []
            self.y = 760

    def add_text(self, text, bold=False, indent=0, font_size=None):
        if font_size:
            old_size = self.font_size
            self.set_font_size(font_size)

        x = self.margin_left + indent
        max_chars = int((self.page_width - x - 50) / (self.font_size * 0.5))
        lines = self._wrap_text(text, max_chars)

        self._check_page_break(len(lines))

        font = "/F2" if bold else "/F1"
        for line in lines:
            escaped = line.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")
            self.current_page_lines.append(
                f"BT {font} {self.font_size} Tf {x} {self.y} Td ({escaped}) Tj ET"
            )
            self.y -= self.line_height

        if font_size:
            self.set_font_size(old_size)

    def add_title(self, text):
        self.y -= 5
        self.add_text(text, bold=True, font_size=16)
        self.y -= 5

    def add_heading(self, text):
        self.y -= 8
        # Draw underline
        self.current_page_lines.append(
            f"0.7 0.7 0.7 RG 0.5 w {self.margin_left} {self.y + 12} m {self.page_width - 50} {self.y + 12} l S 0 0 0 RG"
        )
        self.add_text(text, bold=True, font_size=12)
        self.y -= 2

    def add_line(self):
        self.y -= 3
        self.current_page_lines.append(
            f"0.5 0.5 0.5 RG 0.5 w {self.margin_left} {self.y} m {self.page_width - 50} {self.y} l S 0 0 0 RG"
        )
        self.y -= 5

    def add_space(self, pts=10):
        self.y -= pts

    def add_box(self, lines_of_text):
        """Draw a bordered box with text inside."""
        self._check_page_break(len(lines_of_text) + 2)
        box_top = self.y + 5
        self.y -= 5
        for line in lines_of_text:
            self.add_text(line, indent=10)
        self.y -= 5
        box_bottom = self.y
        # Draw rectangle
        self.current_page_lines.append(
            f"0.4 0.4 0.4 RG 0.8 w {self.margin_left - 5} {box_bottom} "
            f"{self.page_width - self.margin_left - 40} {box_top - box_bottom} re S 0 0 0 RG"
        )
        self.y -= 5

    def add_stamp_header(self, denomination, serial, state="Jammu & Kashmir"):
        date = (datetime.now() - timedelta(days=random.randint(5, 30))).strftime("%d/%m/%Y")
        st = state[:2].upper()
        lines = [
            "GOVERNMENT OF INDIA - e-STAMP CERTIFICATE",
            "Stock Holding Corporation of India Ltd. (SHCIL)",
            f"Certificate No: IN-{st}{serial}  |  Stamp Duty: Rs. {denomination:,}/-",
            f"State: {state}  |  Certificate Issued Date: {date}",
            f"Account Ref: SHCIL/{st}/{random.randint(100000,999999)}/2026  |  Unique Doc Ref: SUBIN{st}{random.randint(10000,99999)}",
        ]
        self._check_page_break(len(lines) + 2)
        box_top = self.y + 5
        self.y -= 3
        self.add_text(lines[0], bold=True, indent=10, font_size=10)
        for l in lines[1:]:
            self.add_text(l, indent=10, font_size=9)
        self.y -= 5
        box_bottom = self.y
        self.current_page_lines.append(
            f"0 0 0 RG 1.5 w {self.margin_left - 5} {box_bottom} "
            f"{self.page_width - self.margin_left - 40} {box_top - box_bottom} re S"
        )
        self.y -= 10

    def add_reg_box(self, reg_no, date, sro, book="1", vol=None):
        """Registration box in top-right area."""
        rx = 380
        ry = self.y + 5
        lines = [f"Registration No: {reg_no}", f"Book No: {book}"]
        if vol:
            lines.append(f"Volume No: {vol}")
        lines += [f"Date: {date}", f"SRO: {sro}"]
        h = len(lines) * 13 + 10
        self.current_page_lines.append(
            f"0 0 0 RG 1.2 w {rx} {ry - h} {170} {h} re S"
        )
        for i, l in enumerate(lines):
            escaped = l.replace("(", "\\(").replace(")", "\\)")
            self.current_page_lines.append(
                f"BT /F1 9 Tf {rx + 8} {ry - 15 - i * 13} Td ({escaped}) Tj ET"
            )

    def add_signatures(self, left_name, left_role, right_name, right_role):
        self.y -= 30
        self._check_page_break(4)
        # Left signature
        self.current_page_lines.append(
            f"0 0 0 RG 0.5 w {self.margin_left + 20} {self.y} m {self.margin_left + 180} {self.y} l S"
        )
        self.current_page_lines.append(
            f"BT /F1 10 Tf {self.margin_left + 40} {self.y - 14} Td (Sd/- {left_name}) Tj ET"
        )
        self.current_page_lines.append(
            f"BT /F2 9 Tf {self.margin_left + 60} {self.y - 26} Td ({left_role}) Tj ET"
        )
        # Right signature
        rx = 350
        self.current_page_lines.append(
            f"0 0 0 RG 0.5 w {rx} {self.y} m {rx + 160} {self.y} l S"
        )
        self.current_page_lines.append(
            f"BT /F1 10 Tf {rx + 20} {self.y - 14} Td (Sd/- {right_name}) Tj ET"
        )
        self.current_page_lines.append(
            f"BT /F2 9 Tf {rx + 40} {self.y - 26} Td ({right_role}) Tj ET"
        )
        self.y -= 40

    def save(self, filepath):
        if self.current_page_lines:
            self.pages.append(self.current_page_lines)

        objects = []
        # Obj 1: Catalog
        objects.append("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj")
        # Obj 2: Pages (placeholder, fill page refs later)
        page_obj_start = 5  # pages start at obj 5
        page_refs = " ".join(f"{page_obj_start + i * 2} 0 R" for i in range(len(self.pages)))
        objects.append(f"2 0 obj\n<< /Type /Pages /Kids [{page_refs}] /Count {len(self.pages)} >>\nendobj")
        # Obj 3: Font Helvetica (regular)
        objects.append("3 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>\nendobj")
        # Obj 4: Font Helvetica-Bold
        objects.append("4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>\nendobj")

        # Pages and their content streams
        for i, page_lines in enumerate(self.pages):
            stream_content = "\n".join(page_lines)
            stream_bytes = stream_content.encode("latin-1", errors="replace")
            content_obj_num = page_obj_start + i * 2 + 1
            page_obj_num = page_obj_start + i * 2

            # Page object
            objects.append(
                f"{page_obj_num} 0 obj\n"
                f"<< /Type /Page /Parent 2 0 R "
                f"/MediaBox [0 0 {self.page_width} {self.page_height}] "
                f"/Contents {content_obj_num} 0 R "
                f"/Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> >>\n"
                f"endobj"
            )
            # Content stream
            objects.append(
                f"{content_obj_num} 0 obj\n"
                f"<< /Length {len(stream_bytes)} >>\n"
                f"stream\n{stream_content}\nendstream\n"
                f"endobj"
            )

        # Build PDF
        pdf = b"%PDF-1.4\n%\xe2\xe3\xcf\xd3\n"
        offsets = []
        for obj in objects:
            offsets.append(len(pdf))
            pdf += obj.encode("latin-1", errors="replace") + b"\n"

        xref_offset = len(pdf)
        pdf += b"xref\n"
        pdf += f"0 {len(objects) + 1}\n".encode()
        pdf += b"0000000000 65535 f \n"
        for off in offsets:
            pdf += f"{off:010d} 00000 n \n".encode()

        pdf += b"trailer\n"
        pdf += f"<< /Size {len(objects) + 1} /Root 1 0 R >>\n".encode()
        pdf += b"startxref\n"
        pdf += f"{xref_offset}\n".encode()
        pdf += b"%%EOF\n"

        os.makedirs(os.path.dirname(filepath), exist_ok=True)
        with open(filepath, "wb") as f:
            f.write(pdf)


# ── Document Generators ─────────────────────────────────────────────

def gen_jk_fraud_01(path):
    """Unregistered sale deed - NO registration number"""
    p = SimplePDF()
    p.add_stamp_header(50000, random.randint(10000000, 99999999))
    p.add_title("SALE DEED")
    p.add_text("(Vikray Vilekh)", font_size=10)
    p.add_space(10)
    p.add_text("This Deed of Sale is executed on this 15th day of March, 2026 at Srinagar, Union Territory of Jammu & Kashmir.")
    p.add_heading("BETWEEN:")
    p.add_text("FIRST PARTY (VENDOR): Shri Mohammad Ashraf Dar, S/o Late Ghulam Ahmad Dar, R/o House No. 45, Rajbagh Colony, Lal Chowk, Srinagar - 190001, Aadhaar No: 7456 XXXX 8923 (hereinafter referred to as the VENDOR)", bold=True)
    p.add_space()
    p.add_text("SECOND PARTY (VENDEE): Shri Rakesh Kumar Sharma, S/o Shri Prem Nath Sharma, R/o 23-A, Gandhi Nagar, Jammu - 180004, Aadhaar No: 9283 XXXX 4561 (hereinafter referred to as the VENDEE)", bold=True)
    p.add_heading("PROPERTY DESCRIPTION:")
    p.add_text("All that piece and parcel of land measuring 10 Kanals (50,000 sq ft approximately) situated at Khasra No. 234/5, 234/6, and 235/1, Khata No. 89, Khewat No. 156, Village Harwan, Tehsil Karan Nagar, District Srinagar, bounded as follows:")
    p.add_text("1. NORTH: Land of Shri Abdul Rashid Bhat (Khasra No. 233)", indent=20)
    p.add_text("2. SOUTH: Government Road (30 ft wide)", indent=20)
    p.add_text("3. EAST: Jhelum River embankment", indent=20)
    p.add_text("4. WEST: Land of Smt. Fatima Begum (Khasra No. 236)", indent=20)
    p.add_heading("CONSIDERATION:")
    p.add_text("The total sale consideration agreed upon between the parties is Rs. 85,00,000/- (Rupees Eighty Five Lakhs Only), out of which Rs. 20,00,000/- has been paid by way of demand draft No. 456789 dated 10/02/2026 drawn on J&K Bank, Lal Chowk Branch, and the balance amount of Rs. 65,00,000/- is being paid today by RTGS Transfer Reference No. JKBK2026031500234.")
    p.add_heading("COVENANTS AND REPRESENTATIONS:")
    p.add_text("1. The Vendor hereby declares that the said property is his self-acquired property and he has absolute right, title and interest over the same.", indent=20)
    p.add_text("2. The Vendor declares that the property is free from all encumbrances, liens, charges, mortgages, court attachments, acquisitions and any other claims.", indent=20)
    p.add_text("3. The Vendor has paid all taxes, cesses, levies and other government dues up to the date of this sale deed.", indent=20)
    p.add_text("4. The Vendor shall indemnify the Vendee against any claims arising from title defects.", indent=20)
    p.add_text("5. Possession of the property has been handed over to the Vendee on the date of execution of this deed.", indent=20)
    p.add_heading("TITLE HISTORY:")
    p.add_text("The Vendor acquired the said property through inheritance from his late father Shri Ghulam Ahmad Dar as per Mutation Order No. 45/2018 dated 23/06/2018 passed by Tehsildar, Karan Nagar. The original title traces back to Revenue Records of 1972.")
    p.add_heading("MARKET VALUE DECLARATION:")
    p.add_text("The market value as per Circle Rate notified by Department of Revenue, UT of J&K vide Notification No. REV/2025/CR/456 dated 01/04/2025 for Harwan, Srinagar is Rs. 800/- per sq ft. Total circle rate value: 50,000 sq ft x Rs. 800 = Rs. 4,00,00,000/- (Four Crore). Sale consideration of Rs. 85 Lakhs is declared as the actual transaction value.")
    p.add_space(15)
    p.add_text("[Document to be presented for registration at SRO Srinagar - REGISTRATION PENDING]", font_size=10)
    p.add_heading("WITNESSES:")
    p.add_text("1. Shri Mushtaq Ahmad Lone, R/o Rajbagh, Srinagar (Aadhaar: 6734 XXXX 2198)")
    p.add_text("2. Shri Vijay Kumar Pandita, R/o Gandhi Nagar, Jammu (Aadhaar: 8912 XXXX 3456)")
    p.add_signatures("Mohammad Ashraf Dar", "(VENDOR)", "Rakesh Kumar Sharma", "(VENDEE)")
    p.add_text("This document is executed on non-judicial stamp paper of Rs. 50,000/-. Biometric verification pending. Document identification number will be assigned upon registration.", font_size=9)
    p.save(path)


def gen_jk_fraud_02(path):
    """Tribal land illegal transfer to private company"""
    p = SimplePDF()
    p.add_stamp_header(30000, random.randint(10000000, 99999999))
    p.add_reg_box('4521/2026', '08/02/2026', 'Rajouri')
    p.add_title("SALE DEED")
    p.add_text("(For Agricultural Land - Tribal Area)", font_size=10)
    p.add_space(10)
    p.add_text("This Deed of Sale executed on 8th February 2026 at Rajouri, UT of Jammu & Kashmir.")
    p.add_heading("PARTIES:")
    p.add_text("VENDOR: Shri Bashir Ahmed Gujjar, S/o Mohammad Hussain Gujjar, Caste: GUJJAR (Scheduled Tribe), R/o Village Darhal, Tehsil Darhal, District Rajouri - 185135. Aadhaar: 5623 XXXX 8901. ST Certificate No: SC/RAJ/2019/4567.", bold=True)
    p.add_space()
    p.add_text("VENDEE: M/s Himalayan Heights Developers Pvt. Ltd., through its Director Shri Suresh Mehta, S/o Shri R.K. Mehta, R/o C-45, Vasant Kunj, New Delhi - 110070, Registered Office: Plot 12, Industrial Area, Rajouri. CIN: U70100JK2024PTC009876.", bold=True)
    p.add_heading("SCHEDULE OF PROPERTY:")
    p.add_text("Agricultural land measuring 15 Kanals 10 Marlas at Khasra No. 567/1, 567/2, 568, Khata No. 234, Village Palri, Tehsil Darhal, District Rajouri. Currently classified as Agricultural (Abi/Irrigated) in Revenue Records.")
    p.add_heading("CONSIDERATION:")
    p.add_text("Total: Rs. 45,00,000/- (Rupees Forty Five Lakhs Only). Paid via RTGS Ref: SBIN2026020800567 dated 08/02/2026.")
    p.add_heading("NOC FROM DISTRICT COLLECTOR:")
    p.add_box([
        "OFFICE OF THE DISTRICT DEVELOPMENT COMMISSIONER",
        "District Rajouri, UT of Jammu & Kashmir",
        "",
        "No: DC/RAJ/NOC/2026/123   Dated: 01/02/2026",
        "",
        "Subject: NOC for transfer of agricultural land.",
        "",
        "After due verification, No Objection is granted for transfer",
        "of land in Khasra 567/1, 567/2, 568 of Village Palri to",
        "M/s Himalayan Heights Developers Pvt. Ltd. for agricultural",
        "purposes only.",
        "",
        "Sd/- District Development Commissioner, Rajouri",
    ])
    p.add_heading("DECLARATIONS:")
    p.add_text("1. The Vendor declares he is the absolute owner and is transferring voluntarily without any coercion or undue influence.", indent=20)
    p.add_text("2. The Vendee declares the land shall continue to be used for agricultural/horticultural purposes.", indent=20)
    p.add_text("3. Both parties declare this transaction complies with all applicable laws including the J&K Land Revenue Act.", indent=20)
    p.add_heading("WITNESSES:")
    p.add_text("1. Shri Mohd Rafiq Choudhary, R/o Darhal, Rajouri")
    p.add_text("2. Shri Anil Gupta, R/o Main Market, Rajouri")
    p.add_signatures("Bashir Ahmed Gujjar", "(VENDOR - ST)", "Suresh Mehta (Director)", "(VENDEE - Company)")
    p.save(path)


def gen_jk_fraud_03(path):
    """Benami transaction - 22yr student buying 1.8cr property"""
    p = SimplePDF()
    p.add_stamp_header(90000, random.randint(10000000, 99999999))
    p.add_reg_box('6789/2026', '20/03/2026', 'Anantnag', vol='234')
    p.add_title("SALE DEED")
    p.add_text("(Agricultural Land - Anantnag)", font_size=10)
    p.add_space(10)
    p.add_text("Executed on 20th March 2026 at Sub-Registrar Office, Anantnag.")
    p.add_heading("PARTIES:")
    p.add_text("VENDOR: Shri Ghulam Nabi Bhat, S/o Late Abdul Ahad Bhat, Age: 62 years, Occupation: Retired Government Teacher, R/o Village Mattan, District Anantnag - 192101. Aadhaar: 8234 XXXX 5678.", bold=True)
    p.add_space()
    p.add_text("VENDEE: Shri Faisal Rashid Mir, S/o Shri Rashid Ahmad Mir, Age: 22 years, Occupation: Student (pursuing B.Tech from NIT Srinagar), R/o H.No. 78, Khanabal, District Anantnag - 192101. Aadhaar: 3456 XXXX 7890. PAN: ABCPM1234R.", bold=True)
    p.add_heading("PROPERTY:")
    p.add_text("Agricultural land measuring 20 Kanals (1,00,000 sq ft) at Khasra No. 890/1 to 890/5, Village Mattan, Tehsil Mattan, District Anantnag. Apple orchards on 12 kanals. Bounded by: North - National Highway, South - Lidder River, East - Shrine Board Land, West - Village common land.")
    p.add_heading("SALE CONSIDERATION:")
    p.add_text("Total: Rs. 1,80,00,000/- (Rupees One Crore Eighty Lakhs Only).", bold=True)
    p.add_text("- Rs. 30,00,000/- by DD No. 234567 dt. 10/03/2026 (J&K Bank)", indent=20)
    p.add_text("- Rs. 50,00,000/- by RTGS Ref: JKBK2026031500890 dt. 15/03/2026", indent=20)
    p.add_text("- Rs. 1,00,00,000/- by RTGS Ref: JKBK2026032000456 dt. 20/03/2026", indent=20)
    p.add_heading("SOURCE OF FUNDS AFFIDAVIT:")
    p.add_box([
        "AFFIDAVIT",
        "",
        "I, Faisal Rashid Mir, do solemnly affirm and state:",
        "",
        "1. The funds for purchase are from family savings and",
        "   agricultural income.",
        "2. My family has been engaged in apple trade for 20 years.",
        "3. The funds are legitimate and not from any illegal source.",
        "4. I am purchasing for personal agricultural use.",
        "",
        "Deponent: Sd/- Faisal Rashid Mir",
        "Verified at Anantnag on 18/03/2026",
        "Before me: Notary Public, Anantnag (Seal)",
    ])
    p.add_heading("COVENANTS:")
    p.add_text("1. The Vendor warrants clear and marketable title free from all encumbrances.", indent=20)
    p.add_text("2. The Vendor has obtained all necessary clearances for this transfer.", indent=20)
    p.add_text("3. Physical possession delivered to the Vendee on date of registration.", indent=20)
    p.add_text("4. All future property taxes and levies shall be borne by the Vendee.", indent=20)
    p.add_heading("WITNESSES:")
    p.add_text("1. Shri Javaid Ahmad Rather, S/o Habibullah Rather, R/o Mattan (Shopkeeper)")
    p.add_text("2. Shri Showkat Ahmad Bhat, S/o Abdul Rashid Bhat, R/o Khanabal (Teacher)")
    p.add_signatures("Ghulam Nabi Bhat", "(VENDOR)", "Faisal Rashid Mir", "(VENDEE - Student, Age 22)")
    p.save(path)


def gen_jk_fraud_04(path):
    """Government/Roshni Act land - voided title"""
    p = SimplePDF()
    p.add_stamp_header(75000, random.randint(10000000, 99999999))
    p.add_reg_box('3456/2025', '15/11/2025', 'Srinagar-II')
    p.add_title("SALE DEED")
    p.add_text("(Immovable Property - Dal Lake Area)", font_size=10)
    p.add_space(10)
    p.add_text("Executed on 15th November 2025 at SRO Srinagar-II.")
    p.add_heading("PARTIES:")
    p.add_text("VENDOR: Shri Abdul Majeed Wani, S/o Late Habibullah Wani, Age: 58, Occupation: Businessman, R/o Dalgate, Srinagar - 190001. Aadhaar: 4567 XXXX 8901.", bold=True)
    p.add_space()
    p.add_text("VENDEE: Shri Pradeep Kumar Bhat, S/o Shri T.N. Bhat, Age: 45, Occupation: Hotel Owner, R/o Boulevard Road, Srinagar - 190001. Aadhaar: 7890 XXXX 1234.", bold=True)
    p.add_heading("PROPERTY:")
    p.add_text("Land measuring 5 Kanals at Survey No. 123/4, 123/5, on the banks of Dal Lake, Nehru Park area, Tehsil Khanyar, District Srinagar. Existing structures: commercial houseboat parking and tourist facility.")
    p.add_heading("TITLE CLAIM:")
    p.add_text("1. Occupation since 1985 (over 37 years continuous possession)", indent=20)
    p.add_text("2. J&K State Lands (Vesting of Ownership to Occupants) Act, 2001 (Roshni Act) - Allotment Order No. ROSHNI/SGR/2004/789 dated 20/06/2004", indent=20)
    p.add_text("3. Revenue records showing Vendor as occupant since 1990", indent=20)
    p.add_text("4. Property tax paid to SMC since 2005", indent=20)
    p.add_space()
    p.add_text("Note: Original ownership documents from pre-1985 stated as lost/destroyed during turmoil. Duplicate revenue entries obtained in 2001.", font_size=10)
    p.add_heading("CONSIDERATION:")
    p.add_text("Rs. 2,50,00,000/- (Rupees Two Crore Fifty Lakhs Only). Paid via RTGS and demand drafts, Oct-Nov 2025.", bold=True)
    p.add_heading("COVENANTS:")
    p.add_text("1. Vendor warrants title based on long possession and Roshni Act allotment.", indent=20)
    p.add_text("2. Vendor declares no pending litigation.", indent=20)
    p.add_text("3. Possession handed over on date of registration.", indent=20)
    p.add_heading("WITNESSES:")
    p.add_text("1. Shri Farooq Ahmad Shah, R/o Dalgate, Srinagar")
    p.add_text("2. Shri Ashok Kumar, R/o Boulevard Road, Srinagar")
    p.add_signatures("Abdul Majeed Wani", "(VENDOR)", "Pradeep Kumar Bhat", "(VENDEE)")
    p.save(path)


def gen_ka_fraud_01(path):
    """Agricultural land sold as layout plots without DC conversion"""
    p = SimplePDF()
    p.add_stamp_header(25000, random.randint(10000000, 99999999), state='Karnataka')
    p.add_reg_box('12456/2026', '10/03/2026', 'Ramanagara')
    p.add_title("AGREEMENT OF SALE")
    p.add_text("(For Residential Layout Plots - Green Valley Phase 2)", font_size=10)
    p.add_space(10)
    p.add_text("Executed on 10th March 2026 at Ramanagara, Karnataka.")
    p.add_heading("PARTIES:")
    p.add_text("VENDOR/DEVELOPER: M/s Green Valley Layouts, Partnership Firm, through Managing Partner Shri Venkatesh Gowda K.R., S/o Late Rangaiah Gowda, Age: 48, R/o #234, 5th Cross, Bidadi Town, Ramanagara - 562109. PAN: AAFFG5678P.", bold=True)
    p.add_space()
    p.add_text("VENDEE: Shri Prashanth Kumar M., S/o Shri Manjunath B., Age: 34, Occupation: IT Professional, R/o #56, BTM Layout, Bengaluru - 560076. Aadhaar: 5678 XXXX 9012. PAN: BCKPP4567R.", bold=True)
    p.add_heading("PROPERTY:")
    p.add_text("Plot No. 45, measuring 30 ft x 40 ft (1,200 sq ft) in Green Valley Phase-2 Layout, Survey No. 67/2, 67/3, Hoskote Village, Bidadi Hobli, Ramanagara Taluk, Karnataka.")
    p.add_text("Total layout: 2 Acres divided into 52 residential plots.")
    p.add_text("Layout Approval: Bidadi Town Panchayat Resolution No. BTP/2025/Layout/34 dated 15/09/2025.", bold=True)
    p.add_heading("REVENUE RECORDS (RTC/PAHANI):")
    p.add_text("RTC Extract for Sy. No. 67/2, 67/3:")
    p.add_text("- Land Type: Agricultural (Tari/Garden land - Coconut and Arecanut)", indent=20, bold=True)
    p.add_text("- Khata No: 89, Hissa No: 2, 3", indent=20)
    p.add_text("- Owner: Venkatesh Gowda K.R. (Sale Deed 2020)", indent=20)
    p.add_text("- Extent: 2 Acres 5 Guntas", indent=20)
    p.add_text("- Land Revenue: Rs. 450/year (paid up to 2025-26)", indent=20)
    p.add_heading("APPROVALS:")
    p.add_text("1. Gram Panchayat Layout Approval: BTP/2025/Layout/34", indent=20)
    p.add_text("2. DC Land Use Conversion Order (Sec 95, KLR Act): Application pending", indent=20, bold=True)
    p.add_text("3. BMRDA/BDA Approval: Not applicable for this area - as per Developer", indent=20)
    p.add_heading("CONSIDERATION:")
    p.add_text("Rate: Rs. 2,500/sq ft. Total: Rs. 30,00,000/-.")
    p.add_text("Advance: Rs. 5,00,000/- (Receipt No. GVL/2025/R/567). Balance on registration.")
    p.add_heading("WITNESSES:")
    p.add_text("1. Shri Ramesh N., R/o Bidadi (Real Estate Agent)")
    p.add_text("2. Shri Suresh Kumar, R/o Ramanagara (Firm Accountant)")
    p.add_signatures("Venkatesh Gowda K.R.", "(DEVELOPER)", "Prashanth Kumar M.", "(VENDEE)")
    p.save(path)


def gen_ka_fraud_02(path):
    """Scheduled Tribe land sale in Kodagu"""
    p = SimplePDF()
    p.add_stamp_header(15000, random.randint(10000000, 99999999), state='Karnataka')
    p.add_reg_box('2345/2026', '05/02/2026', 'Madikeri')
    p.add_title("SALE DEED")
    p.add_text("(Agricultural Land - Kodagu District)", font_size=10)
    p.add_space(10)
    p.add_text("Executed on 5th February 2026 at SRO Madikeri, Kodagu District, Karnataka.")
    p.add_heading("PARTIES:")
    p.add_text("VENDOR: Shri Appaiah B., S/o Late Biddaiah, Age: 55, Caste: Jenu Kuruba (Scheduled Tribe), Occupation: Agriculturist, R/o Hoskeri Village, Somwarpet Taluk, Kodagu - 571236. ST Certificate: REV/KDG/ST/2010/456. Aadhaar: 2345 XXXX 6789.", bold=True)
    p.add_space()
    p.add_text("VENDEE: Shri Deepak Agarwal, S/o Shri Ramesh Agarwal, Age: 40, Occupation: Coffee Estate Owner, R/o #12, MG Road, Madikeri - 571201. Aadhaar: 8901 XXXX 3456. PAN: AAKPA5678Q.", bold=True)
    p.add_heading("PROPERTY:")
    p.add_text("Agricultural land measuring 3 Acres 20 Guntas at Survey No. 89/1, 89/2, Hoskeri Village, Somwarpet Taluk, Kodagu District. Land Type: Coffee plantation with pepper vines. RTC Khata No: 67.")
    p.add_heading("LAND GRANT HISTORY:")
    p.add_text("This land was originally granted to the Vendor's father under the Karnataka Land Reforms Act, 1961 vide Grant Certificate No. LR/KDG/1978/234 dated 15/08/1978 by the Land Tribunal, Somwarpet - specifically for landless Scheduled Tribe beneficiary for agricultural livelihood.", bold=True)
    p.add_heading("RELEASE CERTIFICATE:")
    p.add_box([
        "OFFICE OF THE ASSISTANT COMMISSIONER, MADIKERI",
        "No: AC/MDK/REL/2025/89    Date: 20/12/2025",
        "",
        "Sub: Release Certificate under PTCL Act 1978 for",
        "     Sy. 89/1, 89/2 Hoskeri",
        "",
        "After verifying that 45 years have elapsed since the",
        "original grant, and the grantee family has been in",
        "continuous possession, this certificate is issued",
        "permitting transfer.",
        "",
        "Sd/- Assistant Commissioner (Revenue), Kodagu Division",
    ])
    p.add_heading("CONSIDERATION:")
    p.add_text("Rs. 18,00,000/- (Rupees Eighteen Lakhs Only). Paid via NEFT.", bold=True)
    p.add_heading("WITNESSES:")
    p.add_text("1. Shri Muthappa K., R/o Hoskeri Village, Somwarpet")
    p.add_text("2. Shri Sunil B.M., R/o Kushalnagar, Kodagu")
    p.add_signatures("Appaiah B.", "(VENDOR - ST)", "Deepak Agarwal", "(VENDEE)")
    p.save(path)


def gen_jk_legit_01(path):
    """Fully compliant registered sale deed"""
    p = SimplePDF()
    p.add_stamp_header(120000, random.randint(10000000, 99999999))
    p.add_reg_box('8827/2026', '25/03/2026', 'Jammu-I', book='1', vol='567')
    p.add_title("REGISTERED SALE DEED")
    p.add_text("(Under Section 17 of the Registration Act, 1908)", font_size=10)
    p.add_space(10)
    p.add_text("This Deed of Sale is made and executed on this 25th day of March, 2026 at the office of the Sub-Registrar, Jammu-I, District Jammu, Union Territory of Jammu & Kashmir.")
    p.add_heading("PARTIES:")
    p.add_text("VENDOR: Shri Rajinder Singh Chib, S/o Shri Baldev Singh Chib, Age: 55, Occupation: Retired Army Officer (Retd. Colonel), R/o Quarter No. 12, Officers Enclave, Talab Tillo, Jammu - 180002. Aadhaar: 6789 XXXX 2345. PAN: AAKPC5678L. Present before Sub-Registrar with original documents and biometric verification.", bold=True)
    p.add_space()
    p.add_text("VENDEE: Smt. Neelam Kumari, W/o Shri Vikram Gupta, Age: 38, Occupation: Software Engineer, R/o Flat 4B, Shivalik Heights, Channi Himmat, Jammu - 180015. Aadhaar: 2345 XXXX 6789. PAN: BFJPK4567M. Present before Sub-Registrar with biometric verification.", bold=True)
    p.add_heading("SCHEDULE OF PROPERTY:")
    p.add_text("Residential plot measuring 8 Marlas (2,178 sq ft) with constructed house (Ground + First Floor, total built-up: 3,200 sq ft) at:")
    p.add_text("Khasra No: 456/2, Khata No: 123, Khewat No: 89", indent=20)
    p.add_text("Ward No: 15, Mohalla Rehari Colony, Tehsil Jammu South, District Jammu", indent=20)
    p.add_text("Municipal House No: R-234, Property ID: JMC/2019/R/5678", indent=20)
    p.add_space()
    p.add_text("Boundaries:")
    p.add_text("North: 20 ft wide municipal road | South: Property of Shri Romesh Chander (R-235)", indent=20)
    p.add_text("East: Property of Smt. Kamla Devi (R-233) | West: 10 ft wide lane", indent=20)
    p.add_heading("CONSIDERATION & STAMP DUTY:")
    p.add_text("Sale Consideration: Rs. 1,20,00,000/- (One Crore Twenty Lakhs)", bold=True)
    p.add_text("Circle Rate Value: Rs. 1,15,00,000/- (per Collector Rate 2025-26)")
    p.add_text("Stamp Duty Paid: Rs. 1,20,000/- (5% + 1% cess)", bold=True)
    p.add_text("Registration Fee: Rs. 12,000/- (1%)")
    p.add_text("Payment: RTGS Ref: HDFC2026032000123 - Rs. 1,20,00,000/-")
    p.add_text("TDS u/s 194-IA: Rs. 1,20,000/- deposited (Challan: BSR/JMU/2026/4567)")
    p.add_heading("TITLE CHAIN:")
    p.add_text("1. JDA Allotment Letter No. JDA/ALT/1995/789 dt. 12/05/1995 (to Vendor's father)", indent=20)
    p.add_text("2. Mutation Order No. 567/2018 dt. 10/08/2018 (Legal Heir Certificate: LHC/JMU/2018/234)", indent=20)
    p.add_text("3. Building Plan: JMC/BP/2005/456 | Completion Certificate: JMC/CC/2007/123", indent=20)
    p.add_heading("ENCUMBRANCE CERTIFICATE:")
    p.add_text("EC No: SRO-JMU-I/EC/2026/890 for 30 years (01/01/1996 to 25/03/2026) - CLEAR. No encumbrances, mortgages, liens, or pending litigation.", bold=True)
    p.add_heading("DECLARATIONS:")
    p.add_text("1. Vendor declares absolute ownership with marketable title.", indent=20)
    p.add_text("2. Property free from all encumbrances, disputes, and acquisition.", indent=20)
    p.add_text("3. All property taxes, water/electricity charges paid till date.", indent=20)
    p.add_text("4. Vendor indemnifies Vendee against all future claims.", indent=20)
    p.add_text("5. Physical possession handed over on registration date.", indent=20)
    p.add_heading("WITNESSES:")
    p.add_text("1. Shri Arun Sharma, R/o Rehari Colony, Jammu (Aadhaar: 4567 XXXX 8901)")
    p.add_text("2. Smt. Poonam Gupta, R/o Channi Himmat, Jammu (Aadhaar: 7890 XXXX 1234)")
    p.add_signatures("Col. Rajinder Singh Chib (Retd.)", "(VENDOR)", "Smt. Neelam Kumari", "(VENDEE)")
    p.add_space(15)
    p.add_heading("REGISTRATION ENDORSEMENT:")
    p.add_text("Registered after biometric verification of both parties, examination of original documents, and payment of all statutory duties. Doc No. 8827/2026, Book-I, Volume 567.", bold=True)
    p.add_space()
    p.add_text("Sd/- Sub-Registrar, Jammu-I", bold=True)
    p.add_text("Seal & Date: 25/03/2026")
    p.save(path)


def gen_ka_legit_01(path):
    """Fully compliant registered sale deed - Bangalore"""
    p = SimplePDF()
    p.add_stamp_header(250000, random.randint(10000000, 99999999), state='Karnataka')
    p.add_reg_box('34567/2026', '18/03/2026', 'Bengaluru South', book='1', vol='890')
    p.add_title("SALE DEED (REGISTERED)")
    p.add_text("(Under Registration Act 1908 & Transfer of Property Act 1882)", font_size=10)
    p.add_space(10)
    p.add_text("This Deed of Sale executed on 18th March 2026 at SRO Bengaluru South.")
    p.add_heading("PARTIES:")
    p.add_text("VENDOR: Shri Narayana Murthy H.R., S/o Late Shri Rangaswamy H., Age: 60, Occupation: Retired Bank Manager, R/o #78, JP Nagar 2nd Phase, Bengaluru - 560078. Aadhaar: 3456 XXXX 7890. PAN: AANPM5678K. Biometric verified.", bold=True)
    p.add_space()
    p.add_text("VENDEE: Smt. Priya Ramesh, W/o Shri Ramesh S., Age: 42, Occupation: Doctor (MBBS, MD), R/o #23, Jayanagar 4th Block, Bengaluru - 560041. Aadhaar: 8901 XXXX 2345. PAN: BCRPR6789M. Biometric verified.", bold=True)
    p.add_heading("SCHEDULE OF PROPERTY:")
    p.add_text("Site No: 234, measuring 40 ft x 60 ft (2,400 sq ft) with G+2 house (4,800 sq ft built-up)")
    p.add_text("4th Main Road, BDA Layout, JP Nagar 5th Phase", indent=20)
    p.add_text("Survey No: 45/1, Ward No: 177, Bengaluru South Taluk", indent=20)
    p.add_text("BBMP Property ID: BBM/JS/2019/PID-45678", indent=20)
    p.add_text("Khata No: A-5678 (A-Khata), BBMP Zone: South", indent=20, bold=True)
    p.add_space()
    p.add_text("Boundaries: East - 40ft BDA Road | West - Site 235 | North - Site 220 | South - 30ft Cross Road")
    p.add_heading("TITLE CHAIN:")
    p.add_text("1. BDA Allotment: BDA/JP5/ALT/1992/567 dated 20/05/1992 (Vendor's father)", indent=20)
    p.add_text("2. BDA Sale Deed: Doc No. 12345/1994, SRO Jayanagar dt. 15/03/1994", indent=20)
    p.add_text("3. Khata Transfer: BBMP/KHT/2015/7890 dt. 10/09/2015 (via Legal Heir Certificate)", indent=20)
    p.add_text("4. Building Plan: BBMP/BP/2016/1234 | OC: BBMP/OC/2018/567", indent=20)
    p.add_heading("ENCUMBRANCE CERTIFICATE:")
    p.add_text("EC No: SRO-BLR-S/EC/2026/4567 for 34 years (1992-2026) - CLEAR. No encumbrances.", bold=True)
    p.add_heading("CONSIDERATION & DUTIES:")
    p.add_text("Sale Consideration: Rs. 2,40,00,000/- (Two Crore Forty Lakhs)", bold=True)
    p.add_text("Guidance Value: Rs. 2,16,00,000/- (2,400 sq ft x Rs. 9,000/sq ft)")
    p.add_text("Stamp Duty: Rs. 12,00,000/- (5%) | Cess: Rs. 2,40,000/- (1%) | Reg Fee: Rs. 30,000/-", bold=True)
    p.add_text("Total Govt Dues: Rs. 14,70,000/-")
    p.add_text("Payment: RTGS ICICBLR2026031800789 - Rs. 2,40,00,000/-")
    p.add_text("TDS 194-IA: Rs. 2,40,000/- (CRN/BLR/2026/8901)")
    p.add_heading("COVENANTS:")
    p.add_text("1. Clear marketable title warranted.", indent=20)
    p.add_text("2. Free from encumbrances and litigation.", indent=20)
    p.add_text("3. All taxes paid. Original documents handed over.", indent=20)
    p.add_text("4. Vendor to assist in Khata transfer & BBMP mutation.", indent=20)
    p.add_text("5. Vendor indemnifies against all future claims.", indent=20)
    p.add_heading("WITNESSES:")
    p.add_text("1. Shri Manjunath K., R/o JP Nagar (Aadhaar: 1234 XXXX 5678)")
    p.add_text("2. Smt. Geetha B.S., R/o Jayanagar (Aadhaar: 6789 XXXX 0123)")
    p.add_signatures("H.R. Narayana Murthy", "(VENDOR)", "Dr. Priya Ramesh", "(VENDEE)")
    p.add_space(15)
    p.add_heading("REGISTRATION ENDORSEMENT:")
    p.add_text("Biometric verified. All original documents examined. Statutory duties paid in full. Doc No. 34567/2026, Book-I, Vol 890.", bold=True)
    p.add_space()
    p.add_text("Sd/- Sub-Registrar, Bengaluru South | Seal | 18/03/2026", bold=True)
    p.save(path)


def main():
    base = os.path.dirname(os.path.abspath(__file__))

    docs = [
        ("Fraudulent - J&K", os.path.join(base, 'fraudulent', 'jammu-kashmir'), [
            ('01-unregistered-sale-deed.pdf', gen_jk_fraud_01),
            ('02-tribal-land-illegal-transfer.pdf', gen_jk_fraud_02),
            ('03-benami-transaction.pdf', gen_jk_fraud_03),
            ('04-government-land-roshni.pdf', gen_jk_fraud_04),
        ]),
        ("Fraudulent - Karnataka", os.path.join(base, 'fraudulent', 'karnataka'), [
            ('01-agricultural-land-conversion-fraud.pdf', gen_ka_fraud_01),
            ('02-scheduled-tribe-land-sale.pdf', gen_ka_fraud_02),
        ]),
        ("Legitimate - J&K", os.path.join(base, 'legitimate', 'jammu-kashmir'), [
            ('01-registered-sale-deed.pdf', gen_jk_legit_01),
        ]),
        ("Legitimate - Karnataka", os.path.join(base, 'legitimate', 'karnataka'), [
            ('01-registered-sale-deed.pdf', gen_ka_legit_01),
        ]),
    ]

    for category, folder, files in docs:
        print(f"\n=== {category} ===")
        for filename, gen_func in files:
            filepath = os.path.join(folder, filename)
            gen_func(filepath)
            print(f"  Generated: {filepath}")

    print(f"\n Done! All PDFs generated. Upload them directly to LandGuard.")


if __name__ == '__main__':
    main()
