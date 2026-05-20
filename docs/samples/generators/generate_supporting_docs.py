"""
Generate realistic-looking Indian land supporting documents as PDF files.
Uses raw PDF generation (no external libraries) for Python 3.14 compatibility.
Produces professional-looking documents with headers, boxes, signatures.
"""

import os
from datetime import datetime, timedelta
import random


class PDFBuilder:
    """Multi-page PDF builder with text, headings, boxes, lines."""

    def __init__(self):
        self.page_streams = []
        self.current_y = 760
        self.page_height = 792
        self.page_width = 612
        self.margin = 50

    def _esc(self, s):
        return s.replace('\\', '\\\\').replace('(', '\\(').replace(')', '\\)')

    def new_page(self):
        self.page_streams.append([])
        self.current_y = 760

    def _ensure_space(self, needed):
        if not self.page_streams or self.current_y < (60 + needed):
            self.new_page()

    def text(self, s, x=None, font='F1', size=11, line_height=14):
        self._ensure_space(line_height)
        if x is None:
            x = self.margin
        self.page_streams[-1].append(
            f"BT /{font} {size} Tf {x} {self.current_y} Td ({self._esc(s)}) Tj ET"
        )
        self.current_y -= line_height

    def heading(self, s, size=15, center=True):
        self._ensure_space(size + 10)
        if center:
            x = max(self.margin, (self.page_width - len(s) * size * 0.5) / 2)
        else:
            x = self.margin
        self.page_streams[-1].append(
            f"BT /F2 {size} Tf {x} {self.current_y} Td ({self._esc(s)}) Tj ET"
        )
        self.current_y -= size + 6

    def sub(self, s, size=12):
        self.text(s, font='F2', size=size, line_height=16)

    def line(self):
        self._ensure_space(8)
        y = self.current_y + 2
        self.page_streams[-1].append(
            f"{self.margin} {y} m {self.page_width - self.margin} {y} l S"
        )
        self.current_y -= 8

    def box(self, lines, label=None):
        label_h = 18 if label else 0
        body_h = len(lines) * 13 + 12
        total_h = label_h + body_h
        self._ensure_space(total_h)
        top = self.current_y + 2
        bottom = top - total_h
        self.page_streams[-1].append(
            f"{self.margin} {bottom} {self.page_width - 2*self.margin} {total_h} re S"
        )
        if label:
            self.current_y -= 4
            self.text(label, x=self.margin + 8, font='F2', size=10, line_height=14)
        for ln in lines:
            self.text(ln, x=self.margin + 8, size=10, line_height=13)
        self.current_y -= 10

    def spacer(self, h=8):
        self.current_y -= h

    def build(self, output_path):
        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        parts = ["%PDF-1.4\n"]
        offsets = []

        def write(s):
            offsets.append(sum(len(p) for p in parts))
            parts.append(s)

        n_pages = len(self.page_streams)
        page_obj_start = 3
        content_obj_start = page_obj_start + n_pages
        font_f1 = content_obj_start + n_pages
        font_f2 = font_f1 + 1
        total_objs = font_f2 + 1

        # 1: Catalog
        write("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n")
        # 2: Pages
        kids = " ".join(f"{page_obj_start + i} 0 R" for i in range(n_pages))
        write(
            f"2 0 obj\n<< /Type /Pages /Kids [{kids}] /Count {n_pages} >>\nendobj\n"
        )
        # Page objects
        for i in range(n_pages):
            page_num = page_obj_start + i
            content_num = content_obj_start + i
            write(
                f"{page_num} 0 obj\n<< /Type /Page /Parent 2 0 R "
                f"/MediaBox [0 0 {self.page_width} {self.page_height}] "
                f"/Contents {content_num} 0 R "
                f"/Resources << /Font << /F1 {font_f1} 0 R /F2 {font_f2} 0 R >> >> >>\n"
                f"endobj\n"
            )
        # Content streams
        for i, stream_ops in enumerate(self.page_streams):
            content_num = content_obj_start + i
            stream = "\n".join(stream_ops)
            write(
                f"{content_num} 0 obj\n<< /Length {len(stream)} >>\nstream\n{stream}\nendstream\nendobj\n"
            )
        # Fonts
        write(
            f"{font_f1} 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n"
        )
        write(
            f"{font_f2} 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>\nendobj\n"
        )

        xref_offset = sum(len(p) for p in parts)
        xref = f"xref\n0 {total_objs}\n0000000000 65535 f \n"
        for i in range(total_objs - 1):
            xref += f"{offsets[i]:010d} 00000 n \n"
        parts.append(xref)
        parts.append(
            f"trailer\n<< /Size {total_objs} /Root 1 0 R >>\nstartxref\n{xref_offset}\n%%EOF\n"
        )
        with open(output_path, 'wb') as f:
            f.write("".join(parts).encode('latin-1', 'ignore'))


# ============ DOCUMENTS ============

def gen_ec(path, region, legit=True):
    p = PDFBuilder()
    state = "Jammu & Kashmir" if region == "jammu-kashmir" else "Karnataka"
    sro = "SRO Jammu-I" if region == "jammu-kashmir" else "SRO Bengaluru South"
    p.text("GOVERNMENT OF " + state.upper(), font='F2', size=10)
    p.text("DEPARTMENT OF STAMPS & REGISTRATION", font='F2', size=10)
    p.text(f"Office of the Sub-Registrar, {sro}", size=10)
    p.line()
    p.heading("ENCUMBRANCE CERTIFICATE", size=15)
    p.text("(Form No. 22 - Indian Registration Act, 1908)", size=9)
    p.spacer(6)
    ec = f"EC/{sro[4:7].upper()}/{random.randint(1000,9999)}/2026"
    p.text(f"Certificate No: {ec}", font='F2')
    p.text(f"Date of Issue: {datetime.now().strftime('%d-%m-%Y')}")
    p.text(f"Application No: APP/{random.randint(100000,999999)}/2026")
    p.spacer(8)
    p.sub("PROPERTY DETAILS:")
    if region == "jammu-kashmir":
        p.text("Khasra No: 456/2 | Khata No: 123 | Khewat No: 89", size=10)
        p.text("Village: Rehari Colony | Tehsil: Jammu South | District: Jammu", size=10)
        p.text("Extent: 8 Marlas (2,178 sq ft)", size=10)
    else:
        p.text("Survey No: 45/1 | Khata No: A-5678 | Ward: 177", size=10)
        p.text("Layout: JP Nagar 5th Phase | Taluk: Bengaluru South", size=10)
        p.text("Extent: 40 ft x 60 ft (2,400 sq ft)", size=10)
    p.text(f"Period of Search: 01-01-1996 to {datetime.now().strftime('%d-%m-%Y')}", size=10)
    p.spacer(6)
    p.sub("REGISTERED OWNER:")
    owner = "Smt. Neelam Kumari W/o Vikram Gupta" if region == "jammu-kashmir" else "Dr. Priya Ramesh W/o Ramesh S."
    p.text(owner, size=11)
    p.spacer(6)
    if legit:
        p.box([
            "After careful examination of registers maintained in this office",
            "for the property during the search period, the following",
            "transactions have been recorded:",
            "",
            "1. Sale Deed - Doc No. 8827/2026, Book-I, Vol 567 (25-03-2026)",
            "2. Mutation Order No. 567/2018 (10-08-2018) - Legal heir transfer",
            "3. Original Allotment: JDA/ALT/1995/789 (12-05-1995)",
            "",
            "*** NO MORTGAGES, LIENS, CHARGES, OR PENDING LITIGATIONS ***",
            "*** PROPERTY IS FREE FROM ALL ENCUMBRANCES ***",
        ], label="VERIFICATION RESULT - CLEAR")
        p.spacer(4)
        p.text("CERTIFIED that the above information has been compiled from", size=10)
        p.text("the Register of Index of Documents maintained in this office.", size=10)
    else:
        p.box([
            "The following encumbrances ARE RECORDED:",
            "",
            "1. MORTGAGE - Doc No. 4521/2022, Book-IV (12-07-2022)",
            "   Favour: Bajaj Finserv NBFC | Amount: Rs. 75,00,000/-",
            "   Status: ACTIVE - Outstanding balance not cleared",
            "",
            "2. COURT ATTACHMENT - Case No. OS 234/2024 (Civil Court)",
            "   Filed by: Shri Ravi Kumar (claiming co-ownership)",
            "   Status: PENDING - Injunction order in force",
            "",
            "3. TAX DEFAULT - Notice No. JMC/REC/4567/2025",
            "   Outstanding property tax: Rs. 1,24,500/-",
            "",
            "*** PROPERTY HAS MULTIPLE ENCUMBRANCES - NOT CLEAR ***",
        ], label="VERIFICATION RESULT - ENCUMBRANCES FOUND")
        p.text("Property is NOT free from encumbrances.", font='F2', size=11)
    p.spacer(20)
    p.text("Sub-Registrar", x=380, font='F2', size=10)
    p.text(f"{sro}", x=370, size=9)
    p.text("(Official Seal & Stamp)", x=360, size=9)
    p.build(path)


def gen_tax_receipt(path, region, legit=True):
    p = PDFBuilder()
    if region == "jammu-kashmir":
        muni, prop_id, zone = "JAMMU MUNICIPAL CORPORATION (JMC)", "JMC/2019/R/5678", "Zone-3, Rehari Colony"
    else:
        muni, prop_id, zone = "BRUHAT BENGALURU MAHANAGARA PALIKE (BBMP)", "BBM/JS/2019/PID-45678", "South Zone, JP Nagar"
    p.text(muni, font='F2', size=11)
    p.text("Property Tax Department - e-Receipt", size=10)
    p.line()
    p.heading("PROPERTY TAX RECEIPT", size=14)
    rno = f"PT/{random.randint(100000,999999)}/2026"
    p.text(f"Receipt No: {rno}", font='F2')
    p.text(f"Receipt Date: {datetime.now().strftime('%d-%m-%Y %H:%M:%S')}")
    p.text(f"Transaction ID: TXN{random.randint(10000000,99999999)}")
    p.spacer(6)
    p.sub("PROPERTY DETAILS:")
    p.text(f"Property ID: {prop_id}", size=10)
    p.text(f"Zone: {zone}", size=10)
    owner = "Smt. Neelam Kumari" if region == "jammu-kashmir" else "Dr. Priya Ramesh"
    p.text(f"Owner Name: {owner}", size=10)
    p.text("Property Type: Residential (Self-Occupied)", size=10)
    p.text("Built-up Area: 3,200 sq ft", size=10)
    p.spacer(6)
    p.sub("ASSESSMENT YEAR: 2025-2026")
    if legit:
        p.box([
            "Particulars                              Amount (Rs.)",
            "---------------------------------------------------",
            "Annual Property Tax                       18,500.00",
            "Conservancy Cess                           2,200.00",
            "Health Cess                                1,100.00",
            "Education Cess                               800.00",
            "Library Cess                                 400.00",
            "Solid Waste Mgmt Fee                       1,500.00",
            "Beautification Charge                        500.00",
            "---------------------------------------------------",
            "TOTAL TAX PAYABLE                         25,000.00",
            "Less: Early Payment Rebate (5%)           -1,250.00",
            "Less: Online Payment Rebate (2%)            -500.00",
            "---------------------------------------------------",
            "NET AMOUNT PAID                           23,250.00",
        ], label="TAX BREAKDOWN")
        p.text("Payment Mode: Net Banking (HDFC Bank)", size=10)
        p.text("Payment Status: SUCCESS / PAID IN FULL", font='F2', size=11)
        p.text("Penalty/Interest: NIL", size=10)
        p.text(f"Next Due Date: 31-03-2027", size=10)
        p.spacer(4)
        p.text("Tax Clearance Status: CLEAR - No dues outstanding",
               font='F2', size=11)
    else:
        p.box([
            "Particulars                              Amount (Rs.)",
            "---------------------------------------------------",
            "Property Tax (2023-24) - OVERDUE          18,500.00",
            "Property Tax (2024-25) - OVERDUE          21,000.00",
            "Property Tax (2025-26) - DUE              23,500.00",
            "Penalty @ 2% per month (24 months)        19,800.00",
            "Interest @ 12% p.a.                       12,400.00",
            "Conservancy Cess (3 years)                 6,600.00",
            "Notice Fees                                1,500.00",
            "---------------------------------------------------",
            "TOTAL OUTSTANDING DUES                  1,03,300.00",
        ], label="OUTSTANDING DUES SUMMARY")
        p.text("Last Payment Date: 15-03-2023", size=10)
        p.text("Payment Status: DEFAULTER - 3 YEARS PENDING", font='F2', size=11)
        p.text("Notice Issued: JMC/NOTICE/2025/REC/4567 (12-09-2025)", size=10)
        p.text("Recovery Action: Attachment proceedings initiated", size=10)
    p.spacer(20)
    p.text("System Generated Receipt", x=320, size=9)
    p.text("(Digitally Signed)", x=355, size=9)
    p.build(path)


def gen_title_chain(path, region, legit=True):
    p = PDFBuilder()
    p.text("OFFICE OF THE ADVOCATE & TITLE SEARCH ATTORNEY", font='F2', size=10)
    p.text("Advocate Suresh K. Sharma, Enrolment No: D/4567/2010", size=9)
    p.text("Bar Council of India | High Court Practitioner", size=9)
    p.line()
    p.heading("TITLE INVESTIGATION REPORT", size=14)
    p.text("(Chain of Ownership / Title Deed Search)", size=9)
    p.spacer(4)
    p.text(f"Report Date: {datetime.now().strftime('%d-%m-%Y')}", font='F2')
    p.text(f"Reference: TI/{random.randint(1000,9999)}/2026")
    client = "Smt. Neelam Kumari" if region == "jammu-kashmir" else "Dr. Priya Ramesh"
    p.text(f"Client: {client} (Prospective Purchaser)")
    p.spacer(6)
    p.sub("PROPERTY UNDER INVESTIGATION:")
    if region == "jammu-kashmir":
        p.text("Residential Plot - Khasra 456/2, Rehari Colony, Jammu", size=10)
    else:
        p.text("Residential Site - Survey 45/1, JP Nagar 5th Phase, Bengaluru", size=10)
    p.spacer(6)
    p.sub("CHAIN OF TITLE (LAST 30 YEARS):")
    if legit:
        p.box([
            "LINK 1 (Origin): Government Allotment",
            "  Date: 12-05-1995 | Allottee: Late Shri Baldev Singh Chib",
            "  Document: JDA/ALT/1995/789",
            "  Mode: Public auction - lawful allotment",
            "",
            "LINK 2: Mutation by Inheritance",
            "  Date: 10-08-2018 | Transferee: Col. Rajinder Singh Chib",
            "  Document: Mutation Order 567/2018",
            "  Basis: Legal Heir Certificate LHC/JMU/2018/234",
            "  Status: Duly recorded in revenue records",
            "",
            "LINK 3: Sale Deed (Current Transaction)",
            "  Date: 25-03-2026 | Vendor: Col. Rajinder Singh Chib",
            "  Vendee: Smt. Neelam Kumari",
            "  Document: 8827/2026, Book-I, Vol 567",
            "  Status: Registered with biometric verification",
        ], label="CHAIN OF DOCUMENTS")
        p.sub("ATTORNEY'S OPINION:")
        p.text("Based on examination of original title documents,", size=10)
        p.text("revenue records, mutation entries, and 30-year EC:", size=10)
        p.spacer(2)
        p.text("1. Title is CLEAR, MARKETABLE, and FREE from defects.", font='F2', size=10)
        p.text("2. Chain of ownership is UNBROKEN and PROPERLY DOCUMENTED.", font='F2', size=10)
        p.text("3. NO ADVERSE CLAIMS or pending litigation.", font='F2', size=10)
        p.text("4. Property is SAFE FOR PURCHASE.", font='F2', size=10)
    else:
        p.box([
            "LINK 1: Disputed Allotment",
            "  Date: 1995 (claimed) | Original document MISSING",
            "  Status: ORIGINAL DEED NOT TRACEABLE",
            "",
            "LINK 2: Power of Attorney (NOT a Sale Deed)",
            "  Date: 12-06-2008 | PoA holder: Shri Anil Kumar",
            "  Notarized but NOT REGISTERED",
            "  CONCERN: SC ruling - PoA does not transfer title",
            "",
            "LINK 3: Mutation - DISPUTED",
            "  Mutation Order 234/2018 - CHALLENGED by co-heirs",
            "  Civil Suit OS 456/2019 PENDING in Civil Court",
            "  Stay order against further alienation",
            "",
            "LINK 4: Current Sale Deed",
            "  Stamp duty paid BELOW circle rate - undervaluation flag",
        ], label="CHAIN OF DOCUMENTS")
        p.sub("ATTORNEY'S OPINION:")
        p.text("1. Title is DEFECTIVE and NOT marketable.", font='F2', size=10)
        p.text("2. Chain has BROKEN LINKS and missing original deeds.", font='F2', size=10)
        p.text("3. PENDING LITIGATION challenges seller's title.", font='F2', size=10)
        p.text("4. PURCHASE NOT RECOMMENDED until disputes resolved.", font='F2', size=10)
    p.spacer(20)
    p.text("Sd/-", x=420)
    p.text("Advocate Suresh K. Sharma", x=350, font='F2', size=10)
    p.text("(Enrolment No: D/4567/2010)", x=360, size=9)
    p.build(path)


def gen_mutation(path, region, legit=True):
    p = PDFBuilder()
    if region == "jammu-kashmir":
        office = "OFFICE OF THE TEHSILDAR, JAMMU SOUTH"
        order_no = f"MUT/JMU/{random.randint(100,999)}/2026"
    else:
        office = "OFFICE OF THE TAHSILDAR, BENGALURU SOUTH TALUK"
        order_no = f"KHT/BLR/{random.randint(100,999)}/2026"
    p.text(office, font='F2', size=11)
    p.text("Department of Revenue", size=10)
    p.line()
    p.heading("MUTATION / KHATA TRANSFER ORDER", size=13)
    p.text(f"Order No: {order_no}", font='F2')
    p.text(f"Date: {datetime.now().strftime('%d-%m-%Y')}")
    p.text(f"File Ref: F.No. REV/MUT/{random.randint(1000,9999)}/2026")
    p.spacer(6)
    p.sub("APPLICANT/TRANSFEREE:")
    name = "Smt. Neelam Kumari W/o Vikram Gupta" if region == "jammu-kashmir" else "Dr. Priya Ramesh W/o Ramesh S."
    p.text(name, size=10)
    p.text("Aadhaar: 2345 XXXX 6789 | PAN: BFJPK4567M", size=10)
    p.spacer(6)
    p.sub("PROPERTY DETAILS:")
    if region == "jammu-kashmir":
        p.text("Khasra No: 456/2 | Khata: 123 | Khewat: 89", size=10)
        p.text("Village: Rehari Colony | Area: 8 Marlas", size=10)
    else:
        p.text("Survey No: 45/1 | Khata: A-5678", size=10)
        p.text("Layout: JP Nagar 5th Phase | Area: 2,400 sq ft", size=10)
    p.spacer(6)
    p.sub("BASIS FOR MUTATION:")
    p.text("Registered Sale Deed - Doc No. 8827/2026 (25-03-2026)", size=10)
    vendor = "Col. Rajinder Singh Chib (Retd.)" if region == "jammu-kashmir" else "H.R. Narayana Murthy"
    p.text(f"Vendor: {vendor}", size=10)
    p.spacer(6)
    if legit:
        p.box([
            "Having examined the application, registered sale deed,",
            "and after due verification by Patwari/Village Accountant,",
            "and finding NO objections from any party,",
            "",
            "MUTATION IS HEREBY ORDERED in favour of the applicant.",
            "",
            "Directives to Patwari/VA:",
            "  1. Update the name of new owner in Jamabandi/RTC",
            "  2. Issue new Khata in the applicant's name",
            "  3. Update revenue records accordingly",
            "  4. Inform Municipal Corporation for tax records",
            "",
            "Mutation Fee Paid: Rs. 2,500/- (Receipt MR/2026/4567)",
            "Status: MUTATION COMPLETED & UPDATED",
        ], label="OFFICIAL ORDER")
        p.text("Effective Date: From date of registration of sale deed",
               font='F2', size=10)
    else:
        p.box([
            "APPLICATION RECEIVED but PENDING due to:",
            "",
            "1. OBJECTION filed by Shri Ravi Kumar (S/o Vendor's brother)",
            "   claiming co-ownership under Hindu Succession Act",
            "   Objection No: OBJ/2026/234 (02-04-2026)",
            "",
            "2. Discrepancy in extent:",
            "   Sale Deed mentions 8 Marlas",
            "   Revenue Records show 7 Marlas 18 Sirsai",
            "",
            "3. Mutation Fee NOT PAID",
            "",
            "4. NOC from co-heirs NOT obtained",
            "",
            "MUTATION CANNOT BE PROCESSED until disputes resolved.",
            "Status: PENDING - Notice issued to all parties.",
        ], label="REJECTION / PENDING NOTICE")
        p.text("MUTATION NOT COMPLETED - Title transfer incomplete",
               font='F2', size=11)
    p.spacer(20)
    p.text("Sd/-", x=420)
    tt = "Tehsildar" if region == "jammu-kashmir" else "Tahsildar"
    p.text(tt, x=400, font='F2', size=10)
    p.text("(Office Seal)", x=395, size=9)
    p.build(path)


def gen_oc(path, region, legit=True):
    p = PDFBuilder()
    if region == "jammu-kashmir":
        auth = "JAMMU MUNICIPAL CORPORATION"
        oc_no = f"JMC/OC/{random.randint(100,999)}/2026"
    else:
        auth = "BRUHAT BENGALURU MAHANAGARA PALIKE (BBMP)"
        oc_no = f"BBMP/OC/{random.randint(100,999)}/2018"
    p.text(auth, font='F2', size=11)
    p.text("Town Planning Department", size=10)
    p.line()
    p.heading("OCCUPANCY CERTIFICATE", size=14)
    p.text("(Under the Municipal Corporation Act)", size=9)
    p.text(f"OC No: {oc_no}", font='F2')
    p.text(f"Date of Issue: {datetime.now().strftime('%d-%m-%Y')}")
    p.spacer(6)
    p.sub("BUILDING DETAILS:")
    if region == "jammu-kashmir":
        p.text("Address: R-234, Rehari Colony, Jammu - 180002", size=10)
        p.text("Plot Area: 8 Marlas (2,178 sq ft)", size=10)
        p.text("Building Permit: BP/2005/456", size=10)
    else:
        p.text("Address: #234, 4th Main Rd, JP Nagar 5th Phase", size=10)
        p.text("Plot Area: 40 ft x 60 ft (2,400 sq ft)", size=10)
        p.text("Building Permit: BBMP/BP/2016/1234", size=10)
    p.text("Built-up: G + 2 floors (3,200 sq ft)", size=10)
    owner = "Col. Rajinder Singh Chib (Retd.)" if region == "jammu-kashmir" else "H.R. Narayana Murthy"
    p.text(f"Owner: {owner}", size=10)
    p.spacer(6)
    if legit:
        p.box([
            "This certifies that the building at the above address has",
            "been completed strictly in accordance with the sanctioned",
            "plan, building bylaws, and zonal regulations.",
            "",
            "Inspections carried out:",
            "  - Foundation: PASSED (15-08-2017)",
            "  - Plinth level: PASSED (10-12-2017)",
            "  - Structural: PASSED (20-04-2018)",
            "  - Final: PASSED (15-08-2018)",
            "",
            "Compliance verified:",
            "  [X] Setbacks (front 5ft / sides 3ft / rear 5ft)",
            "  [X] Building height within 11m limit",
            "  [X] FAR 2.0 (sanctioned 2.25)",
            "  [X] Parking provision: 2 cars",
            "  [X] Fire safety NOC obtained",
            "  [X] Rainwater harvesting installed",
            "  [X] Solar water heater installed",
            "",
            "OCCUPANCY PERMITTED - Building fit for habitation.",
        ], label="OCCUPANCY CERTIFICATION")
        p.text("This OC enables khata registration and utility connections.", size=9)
    else:
        p.box([
            "Following inspections, the building is FOUND IN VIOLATION",
            "of sanctioned plan and bylaws:",
            "",
            "Major Violations:",
            "  [X] FAR exceeded by 35%",
            "      Sanctioned: 1,800 sqft | Actual: 2,430 sqft",
            "  [X] Front setback only 2 ft (req: 5 ft)",
            "  [X] Unauthorized 3rd floor (sanctioned: G+1)",
            "  [X] Encroachment on municipal land - 80 sqft",
            "  [X] No parking provided (mandatory: 1 car)",
            "  [X] Rainwater harvesting NOT installed",
            "  [X] No fire safety clearance",
            "",
            "DEMOLITION NOTICE: BBMP/DN/2025/4567 (15-11-2025)",
            "OCCUPANCY CERTIFICATE DENIED.",
            "",
            "Property UNAUTHORIZED for occupation.",
            "Sale RESTRICTED until OC obtained.",
        ], label="DENIAL NOTICE - UNAUTHORIZED CONSTRUCTION")
        p.text("Building NOT FIT for habitation - demolition risk.",
               font='F2', size=10)
    p.spacer(20)
    p.text("Sd/-", x=420)
    p.text("Town Planning Officer", x=370, font='F2', size=10)
    p.text(f"({auth.split()[0]})", x=395, size=9)
    p.build(path)


def gen_building_plan(path, region, legit=True):
    p = PDFBuilder()
    if region == "jammu-kashmir":
        auth = "JAMMU MUNICIPAL CORPORATION"
        bp_no = f"JMC/BP/{random.randint(100,999)}/2005"
    else:
        auth = "BBMP / BDA - LAYOUT APPROVAL CELL"
        bp_no = f"BBMP/BP/{random.randint(1000,9999)}/2016"
    p.text(auth, font='F2', size=11)
    p.text("Town Planning & Building Approval Wing", size=10)
    p.line()
    p.heading("BUILDING PLAN APPROVAL", size=14)
    p.text("(Sanctioned under Building Bylaws & Master Plan)", size=9)
    p.text(f"Sanction No: {bp_no}", font='F2')
    p.text(f"Date of Sanction: {(datetime.now() - timedelta(days=random.randint(30,3000))).strftime('%d-%m-%Y')}")
    p.text(f"Valid Up To: {(datetime.now() + timedelta(days=365)).strftime('%d-%m-%Y')}")
    p.spacer(6)
    p.sub("APPLICANT:")
    name = "Col. Rajinder Singh Chib (Retd.)" if region == "jammu-kashmir" else "Shri H.R. Narayana Murthy"
    p.text(name, size=10)
    p.spacer(4)
    p.sub("SITE DETAILS:")
    if region == "jammu-kashmir":
        p.text("Khasra No: 456/2, Rehari Colony, Jammu", size=10)
        p.text("Plot: 33 ft x 66 ft (8 Marlas)", size=10)
        p.text("Zone: Residential R-1", size=10)
    else:
        p.text("Survey No: 45/1, JP Nagar 5th Phase, Bengaluru", size=10)
        p.text("Plot: 40 ft x 60 ft (2,400 sq ft)", size=10)
        p.text("Zone: Residential Main (RM)", size=10)
    p.spacer(6)
    if legit:
        p.box([
            "Type: Residential Building (G + 2 floors)",
            "Total Built-up Area: 3,200 sq ft",
            "",
            "Floor-wise:",
            "  - Ground: 1,200 sq ft (Parking + Hall + Kitchen)",
            "  - First: 1,000 sq ft (2 BHK)",
            "  - Second: 1,000 sq ft (2 BHK)",
            "",
            "Setbacks Approved:",
            "  Front: 5'-0\"  |  Rear: 5'-0\"  |  Sides: 3'-0\"",
            "",
            "FAR permitted 2.25 | utilized 1.85",
            "Building Height: 10.5 m (within 11 m)",
            "Dwelling Units: 2 | Parking: 2 car + 2 2W",
            "",
            "NOCs obtained: Fire, AAI, Pollution, Trees,",
            "Electrical, Water Supply.",
            "",
            "STATUS: PLAN APPROVED & SANCTIONED",
        ], label="SANCTIONED BUILDING PLAN")
        p.text("Plan Fees Paid: Rs. 45,000/-", size=10)
        p.text("Layout: APPROVED for residential construction",
               font='F2', size=10)
    else:
        p.box([
            "APPLICATION NO: APP/BP/2025/4567 - REJECTED",
            "",
            "1. LAND USE VIOLATION:",
            "   Classified AGRICULTURAL in Master Plan",
            "   DC Conversion u/s 95 KLR Act NOT obtained",
            "",
            "2. ZONING VIOLATION:",
            "   Falls in Green Belt Zone (no construction)",
            "",
            "3. FAR VIOLATION:",
            "   Proposed 3.2 | Permitted 1.75",
            "",
            "4. SETBACK VIOLATION:",
            "   Proposed front setback 0 ft (req 5 ft)",
            "",
            "5. NOCs NOT OBTAINED:",
            "   Fire, AAI, Tree authority - all pending",
            "",
            "6. ENCROACHMENT:",
            "   Plan encroaches on storm water drain by 4 ft",
            "",
            "BUILDING PLAN REJECTED. Layout NOT APPROVED.",
            "Construction will face DEMOLITION.",
        ], label="REJECTION ORDER")
        p.text("STATUS: REJECTED - Construction unauthorized",
               font='F2', size=11)
    p.spacer(20)
    p.text("Sd/-", x=420)
    p.text("Executive Engineer (TP)", x=360, font='F2', size=10)
    p.text(f"({auth.split('/')[0].strip()})", x=395, size=9)
    p.build(path)


def gen_roshni_status(path, region, legit=True):
    p = PDFBuilder()
    if region == "jammu-kashmir":
        title = "ROSHNI ACT STATUS CERTIFICATE"
        office = "OFFICE OF THE DIVISIONAL COMMISSIONER, JAMMU"
        ref = f"DC/JMU/ROSHNI/{random.randint(100,999)}/2026"
        act = "J&K State Lands Act, 2001 (Roshni Act)"
    else:
        title = "LAND REFORMS / PTCL STATUS CERTIFICATE"
        office = "OFFICE OF THE ASSISTANT COMMISSIONER, BENGALURU"
        ref = f"AC/BLR/PTCL/{random.randint(100,999)}/2026"
        act = "Karnataka Land Reforms Act 1961 & PTCL Act 1978"
    p.text(office, font='F2', size=11)
    p.text("Revenue Department - Land Status Verification Cell", size=10)
    p.line()
    p.heading(title, size=13)
    p.text(f"Reference No: {ref}", font='F2')
    p.text(f"Date: {datetime.now().strftime('%d-%m-%Y')}")
    p.text(f"Applicable Act: {act}", size=9)
    p.spacer(6)
    p.sub("PROPERTY UNDER VERIFICATION:")
    if region == "jammu-kashmir":
        p.text("Khasra No: 456/2 | Mohalla: Rehari Colony | Jammu", size=10)
    else:
        p.text("Survey No: 45/1 | JP Nagar 5th Phase | Bengaluru South", size=10)
    p.text("Type: Private Residential Land", size=10)
    p.spacer(6)
    if legit:
        p.box([
            "Detailed verification has been carried out against:",
            "",
            "1. Roshni Act 2001 Beneficiary List - NOT LISTED",
            "2. State Land / Kahcharai Records - NOT FOUND",
            "3. Forest Land Notification - NOT APPLICABLE",
            "4. Wakf Board Records - CLEAR",
            "5. Custodian Property Register - CLEAR",
            "6. Evacuee Property List - CLEAR",
            "7. Acquired Land Notifications - NOT FOUND",
            "8. Tribal Land Register (PTCL/ST/SC) - NOT APPLICABLE",
            "9. CAG Audit List (Roshni scam) - NOT IDENTIFIED",
            "10. HC list of 2020 Roshni judgment - NOT LISTED",
            "",
            "*** PROPERTY FREE FROM ROSHNI / STATE LAND CLAIMS ***",
            "*** SAFE FOR PRIVATE TRANSFER ***",
        ], label="STATUS CHECK RESULT")
        p.text("This certificate confirms clear title under all applicable", size=10)
        p.text("land laws.", size=10)
        p.text("STATUS: CLEAR - NO OBJECTION FOR TRANSFER",
               font='F2', size=11)
    else:
        p.box([
            "Verification has revealed the following:",
            "",
            "1. ROSHNI ACT BENEFICIARY:",
            "   Property LISTED in Roshni Beneficiary List",
            "   Original allotment: ROSHNI/SGR/2004/789",
            "",
            "2. SUPREME COURT JUDGMENT IMPACT:",
            "   J&K High Court judgment (09-10-2020) PIL 19/2011",
            "   STRUCK DOWN Roshni Act as UNCONSTITUTIONAL",
            "   All allotments declared VOID",
            "",
            "3. CAG AUDIT FINDINGS:",
            "   Property identified in CAG audit report 2014",
            "   Listed among ineligible beneficiaries",
            "",
            "4. STATUS OF LAND:",
            "   Land REVERTS to State (now UT)",
            "   Any transfer is INVALID",
            "   Possession liable to be RESUMED",
            "",
            "5. ONGOING ACTIONS:",
            "   Eviction notice NOTICE/EV/2024/567",
            "   Sub-Registrar instructed NOT to register transfer",
            "",
            "*** SERIOUS TITLE DEFECTS ***",
            "*** TRANSFER LEGALLY PROHIBITED ***",
        ], label="STATUS CHECK RESULT - SERIOUS ISSUES")
        p.text("STATUS: NOT CLEAR - TRANSFER PROHIBITED",
               font='F2', size=11)
        p.text("Purchase will result in TOTAL LOSS.",
               font='F2', size=10)
    p.spacer(20)
    p.text("Sd/-", x=420)
    p.text("Verifying Officer", x=385, font='F2', size=10)
    p.text("(Revenue Department)", x=370, size=9)
    p.build(path)


def main():
    base = os.path.dirname(os.path.abspath(__file__))
    gens = [
        ('02-ec.pdf', gen_ec),
        ('03-tax-receipt.pdf', gen_tax_receipt),
        ('04-title-chain.pdf', gen_title_chain),
        ('05-mutation.pdf', gen_mutation),
        ('06-oc.pdf', gen_oc),
        ('07-building-plan.pdf', gen_building_plan),
        ('08-roshni-status.pdf', gen_roshni_status),
    ]
    for kind in ['legitimate', 'fraudulent']:
        is_legit = (kind == 'legitimate')
        print(f"\n=== {kind.upper()} ===")
        for region in ['jammu-kashmir', 'karnataka']:
            print(f"  [{region}]")
            for fname, fn in gens:
                path = os.path.join(base, kind, region, fname)
                try:
                    fn(path, region, legit=is_legit)
                    print(f"    Generated: {fname}")
                except Exception as e:
                    print(f"    ERROR {fname}: {e}")
    print(f"\nAll supporting documents regenerated with rich realistic content.")


if __name__ == '__main__':
    main()
