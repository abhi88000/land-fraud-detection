"""
Generate realistic Indian land documents as PDF files for testing Landshield.
Run: python generate_test_docs.py
PDFs are generated directly.
"""

import os
from datetime import datetime, timedelta
import random
from reportlab.lib.pagesizes import letter, A4
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, PageBreak
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
import re

HTML_TEMPLATE = """<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>{title}</title>
<style>
  @page {{ margin: 2cm; }}
  body {{ font-family: 'Times New Roman', serif; font-size: 12px; line-height: 1.6; max-width: 210mm; margin: 0 auto; padding: 40px; color: #1a1a1a; }}
  .stamp-header {{ background: #fffff0; border: 2px solid #333; padding: 12px 16px; margin-bottom: 30px; font-family: Arial, sans-serif; font-size: 10px; }}
  .stamp-header strong {{ font-size: 11px; }}
  .doc-title {{ text-align: center; font-size: 18px; font-weight: bold; margin: 20px 0 5px; text-transform: uppercase; }}
  .doc-subtitle {{ text-align: center; font-size: 12px; font-style: italic; margin-bottom: 20px; }}
  .reg-box {{ float: right; border: 2px solid #000; padding: 10px 14px; font-family: Arial, sans-serif; font-size: 11px; line-height: 1.8; margin-left: 20px; margin-bottom: 10px; }}
  .section-title {{ font-weight: bold; font-size: 13px; margin-top: 20px; margin-bottom: 8px; text-transform: uppercase; border-bottom: 1px solid #ccc; padding-bottom: 4px; }}
  .clause {{ margin-left: 20px; margin-bottom: 8px; }}
  .clause-num {{ font-weight: bold; }}
  .signature-block {{ display: flex; justify-content: space-between; margin-top: 50px; }}
  .sig {{ text-align: center; }}
  .sig-line {{ width: 180px; border-top: 1px solid #000; margin-bottom: 5px; }}
  .witnesses {{ margin-top: 30px; }}
  .noc-box {{ border: 1px solid #666; padding: 15px; margin: 15px 0; background: #fafafa; }}
  .legal-note {{ font-size: 10px; font-style: italic; color: #555; margin-top: 20px; }}
  .clear {{ clear: both; }}
  .page-break {{ page-break-before: always; }}
</style>
</head>
<body>
{content}
</body>
</html>"""


def save_html(output_dir, filename, title, content):
    os.makedirs(output_dir, exist_ok=True)
    
    # Convert HTML to PDF directly
    pdf_filename = filename.replace('.html', '.pdf')
    pdf_path = os.path.join(output_dir, pdf_filename)
    
    try:
        doc = SimpleDocTemplate(pdf_path, pagesize=A4)
        styles = getSampleStyleSheet()
        story = []
        
        # Title
        title_style = ParagraphStyle(
            'CustomTitle',
            parent=styles['Heading1'],
            fontSize=14,
            textColor='#000000',
            spaceAfter=12,
            alignment=1  # Center
        )
        story.append(Paragraph(title, title_style))
        story.append(Spacer(1, 0.2*inch))
        
        # Clean HTML content
        text_content = re.sub(r'<[^>]+>', '\n', content)
        text_content = re.sub(r'\n\s*\n', '\n', text_content)
        text_content = text_content.strip()
        
        # Add content paragraphs
        body_style = styles['BodyText']
        for line in text_content.split('\n')[:150]:  # Limit lines
            if line.strip():
                try:
                    clean_line = line.strip()[:200]
                    story.append(Paragraph(clean_line, body_style))
                    story.append(Spacer(1, 0.05*inch))
                except:
                    pass
        
        doc.build(story)
        print(f"  Generated: {pdf_filename}")
    except Exception as e:
        print(f"  Error generating {pdf_filename}: {e}")



def stamp_header(denomination, serial, state="Jammu & Kashmir"):
    date = (datetime.now() - timedelta(days=random.randint(5, 30))).strftime("%d/%m/%Y")
    return f"""
    <div class="stamp-header">
        <strong>GOVERNMENT OF INDIA - e-STAMP CERTIFICATE</strong><br>
        Stock Holding Corporation of India Ltd. (SHCIL)<br>
        Certificate No: IN-{state[:2].upper()}{serial} &nbsp;|&nbsp; Stamp Duty: Rs. {denomination:,}/-<br>
        State: {state} &nbsp;|&nbsp; Certificate Issued Date: {date}<br>
        Account Reference: SHCIL/{state[:2].upper()}/{random.randint(100000,999999)}/2026 &nbsp;|&nbsp; Unique Doc Reference: SUBIN{state[:2].upper()}{random.randint(10000,99999)}
    </div>"""


def reg_box(reg_no, date, sro, book="1", vol=None):
    vol_line = f"Volume No: {vol}<br>" if vol else ""
    return f"""
    <div class="reg-box">
        Registration No: <strong>{reg_no}</strong><br>
        Book No: {book}<br>
        {vol_line}
        Date: <strong>{date}</strong><br>
        SRO: {sro}
    </div>"""


def generate_jk_fraud_01(output_dir):
    """Unregistered sale deed - looks complete but NO registration"""
    content = f"""
    {stamp_header(50000, random.randint(10000000, 99999999))}

    <div class="doc-title">SALE DEED</div>
    <div class="doc-subtitle">विक्रय विलेख (Vikray Vilekh)</div>

    <p>This Deed of Sale is executed on this <strong>15th day of March, 2026</strong> at Srinagar,
    Union Territory of Jammu &amp; Kashmir.</p>

    <div class="section-title">BETWEEN:</div>

    <p><strong>FIRST PARTY (VENDOR):</strong> Shri Mohammad Ashraf Dar, S/o Late Ghulam Ahmad Dar,
    R/o House No. 45, Rajbagh Colony, Lal Chowk, Srinagar - 190001,
    Aadhaar No: 7456 XXXX 8923 (hereinafter referred to as the "VENDOR")</p>

    <p><strong>SECOND PARTY (VENDEE):</strong> Shri Rakesh Kumar Sharma, S/o Shri Prem Nath Sharma,
    R/o 23-A, Gandhi Nagar, Jammu - 180004,
    Aadhaar No: 9283 XXXX 4561 (hereinafter referred to as the "VENDEE")</p>

    <div class="section-title">PROPERTY DESCRIPTION:</div>

    <p>All that piece and parcel of land measuring <strong>10 Kanals</strong> (50,000 sq ft approximately)
    situated at Khasra No. 234/5, 234/6, and 235/1, Khata No. 89, Khewat No. 156,
    Village Harwan, Tehsil Karan Nagar, District Srinagar, bounded as follows:</p>

    <div class="clause"><span class="clause-num">1.</span> NORTH: Land of Shri Abdul Rashid Bhat (Khasra No. 233)</div>
    <div class="clause"><span class="clause-num">2.</span> SOUTH: Government Road (30 ft wide)</div>
    <div class="clause"><span class="clause-num">3.</span> EAST: Jhelum River embankment</div>
    <div class="clause"><span class="clause-num">4.</span> WEST: Land of Smt. Fatima Begum (Khasra No. 236)</div>

    <div class="section-title">CONSIDERATION:</div>

    <p>The total sale consideration agreed upon between the parties is <strong>Rs. 85,00,000/-</strong>
    (Rupees Eighty Five Lakhs Only), out of which Rs. 20,00,000/- has been paid by way of
    demand draft No. 456789 dated 10/02/2026 drawn on J&amp;K Bank, Lal Chowk Branch, and
    the balance amount of Rs. 65,00,000/- is being paid today by RTGS Transfer Reference
    No. JKBK2026031500234.</p>

    <div class="section-title">COVENANTS AND REPRESENTATIONS:</div>

    <div class="clause"><span class="clause-num">1.</span> The Vendor hereby declares that the said property is his self-acquired property and he has absolute right, title and interest over the same.</div>
    <div class="clause"><span class="clause-num">2.</span> The Vendor declares that the property is free from all encumbrances, liens, charges, mortgages, court attachments, acquisitions and any other claims whatsoever.</div>
    <div class="clause"><span class="clause-num">3.</span> The Vendor has paid all taxes, cesses, levies and other government dues up to the date of this sale deed.</div>
    <div class="clause"><span class="clause-num">4.</span> The Vendor shall indemnify the Vendee against any claims arising from title defects.</div>
    <div class="clause"><span class="clause-num">5.</span> Possession of the property has been handed over to the Vendee on the date of execution of this deed.</div>

    <div class="page-break"></div>

    <div class="section-title">TITLE HISTORY:</div>
    <p>The Vendor acquired the said property through inheritance from his late father Shri Ghulam Ahmad Dar
    as per Mutation Order No. 45/2018 dated 23/06/2018 passed by Tehsildar, Karan Nagar.
    The original title traces back to Revenue Records of 1972.</p>

    <div class="section-title">MARKET VALUE DECLARATION:</div>
    <p>The market value as per Circle Rate notified by Department of Revenue, UT of J&amp;K vide
    Notification No. REV/2025/CR/456 dated 01/04/2025 for Harwan, Srinagar is Rs. 800/- per sq ft.
    Total circle rate value: 50,000 sq ft x Rs. 800 = Rs. 4,00,00,000/- (Four Crore).
    Sale consideration of Rs. 85 Lakhs is declared as the actual transaction value.</p>

    <p style="font-style: italic; color: #666; margin-top: 30px;">
    [Document to be presented for registration at SRO Srinagar - REGISTRATION PENDING]
    </p>

    <div class="witnesses">
        <div class="section-title">WITNESSES:</div>
        <p>1. Shri Mushtaq Ahmad Lone, R/o Rajbagh, Srinagar (Aadhaar: 6734 XXXX 2198)</p>
        <p>2. Shri Vijay Kumar Pandita, R/o Gandhi Nagar, Jammu (Aadhaar: 8912 XXXX 3456)</p>
    </div>

    <div class="signature-block">
        <div class="sig"><div class="sig-line"></div>Sd/- Mohammad Ashraf Dar<br><em>(VENDOR)</em></div>
        <div class="sig"><div class="sig-line"></div>Sd/- Rakesh Kumar Sharma<br><em>(VENDEE)</em></div>
    </div>

    <p class="legal-note">This document is executed on non-judicial stamp paper of Rs. 50,000/-.
    Biometric verification pending. Document identification number will be assigned upon registration.</p>
    """
    save_html(output_dir, '01-unregistered-sale-deed.html', 'Sale Deed - Unregistered', content)


def generate_jk_fraud_02(output_dir):
    """Tribal land illegal transfer"""
    content = f"""
    {stamp_header(30000, random.randint(10000000, 99999999))}
    {reg_box('4521/2026', '08/02/2026', 'Rajouri')}
    <div class="clear"></div>

    <div class="doc-title">SALE DEED</div>
    <div class="doc-subtitle">(For Agricultural Land - Tribal Area)</div>

    <p>This Deed of Sale executed on <strong>8th February 2026</strong> at Rajouri, UT of Jammu &amp; Kashmir.</p>

    <div class="section-title">PARTIES:</div>

    <p><strong>VENDOR:</strong> Shri Bashir Ahmed Gujjar, S/o Mohammad Hussain Gujjar,
    <u>Caste: GUJJAR (Scheduled Tribe)</u>, R/o Village Darhal, Tehsil Darhal,
    District Rajouri - 185135. Aadhaar: 5623 XXXX 8901.
    <strong>ST Certificate No: SC/RAJ/2019/4567.</strong></p>

    <p><strong>VENDEE:</strong> M/s Himalayan Heights Developers Pvt. Ltd., through its Director
    Shri Suresh Mehta, S/o Shri R.K. Mehta, R/o C-45, Vasant Kunj, New Delhi - 110070,
    Registered Office: Plot 12, Industrial Area, Rajouri.
    CIN: U70100JK2024PTC009876. Aadhaar of Director: 4578 XXXX 1234.</p>

    <div class="section-title">SCHEDULE OF PROPERTY:</div>
    <p>Agricultural land measuring <strong>15 Kanals 10 Marlas</strong> at Khasra No. 567/1, 567/2, 568,
    Khata No. 234, Village Palri, Tehsil Darhal, District Rajouri.
    Currently classified as Agricultural (Abi/Irrigated) in Revenue Records.</p>

    <div class="section-title">CONSIDERATION:</div>
    <p>Total: <strong>Rs. 45,00,000/-</strong> (Rupees Forty Five Lakhs Only).
    Paid via RTGS Ref: SBIN2026020800567 dated 08/02/2026.</p>

    <div class="section-title">NOC FROM DISTRICT COLLECTOR (COPY):</div>
    <div class="noc-box">
        <strong>OFFICE OF THE DISTRICT DEVELOPMENT COMMISSIONER</strong><br>
        District Rajouri, UT of Jammu &amp; Kashmir<br><br>
        No: DC/RAJ/NOC/2026/123 &emsp; Dated: 01/02/2026<br><br>
        Subject: NOC for transfer of agricultural land.<br><br>
        After due verification, No Objection is granted for transfer of land in Khasra 567/1, 567/2, 568
        of Village Palri to M/s Himalayan Heights Developers Pvt. Ltd. for agricultural purposes only.<br><br>
        Sd/-<br>
        District Development Commissioner, Rajouri
    </div>

    <div class="page-break"></div>

    <div class="section-title">DECLARATIONS:</div>
    <div class="clause"><span class="clause-num">1.</span> The Vendor declares he is the absolute owner and is transferring voluntarily without any coercion or undue influence.</div>
    <div class="clause"><span class="clause-num">2.</span> The Vendee declares the land shall continue to be used for agricultural/horticultural purposes.</div>
    <div class="clause"><span class="clause-num">3.</span> Both parties declare this transaction complies with all applicable laws including the J&amp;K Land Revenue Act.</div>

    <div class="witnesses">
        <div class="section-title">WITNESSES:</div>
        <p>1. Shri Mohd Rafiq Choudhary, R/o Darhal, Rajouri</p>
        <p>2. Shri Anil Gupta, R/o Main Market, Rajouri</p>
    </div>

    <div class="signature-block">
        <div class="sig"><div class="sig-line"></div>Sd/- Bashir Ahmed Gujjar<br><em>(VENDOR - ST)</em></div>
        <div class="sig"><div class="sig-line"></div>Sd/- Suresh Mehta (Director)<br><em>(VENDEE - Company)</em></div>
    </div>
    """
    save_html(output_dir, '02-tribal-land-illegal-transfer.html', 'Tribal Land Transfer', content)


def generate_jk_fraud_03(output_dir):
    """Benami transaction - student buying 1.8cr property"""
    content = f"""
    {stamp_header(90000, random.randint(10000000, 99999999))}
    {reg_box('6789/2026', '20/03/2026', 'Anantnag', vol='234')}
    <div class="clear"></div>

    <div class="doc-title">SALE DEED</div>
    <div class="doc-subtitle">(Agricultural Land - Anantnag)</div>

    <p>Executed on <strong>20th March 2026</strong> at Sub-Registrar Office, Anantnag.</p>

    <div class="section-title">PARTIES:</div>

    <p><strong>VENDOR:</strong> Shri Ghulam Nabi Bhat, S/o Late Abdul Ahad Bhat, Age: 62 years,
    Occupation: Retired Government Teacher, R/o Village Mattan, District Anantnag - 192101.
    Aadhaar: 8234 XXXX 5678.</p>

    <p><strong>VENDEE:</strong> Shri Faisal Rashid Mir, S/o Shri Rashid Ahmad Mir, <u>Age: 22 years,
    Occupation: Student (pursuing B.Tech from NIT Srinagar)</u>,
    R/o H.No. 78, Khanabal, District Anantnag - 192101.
    Aadhaar: 3456 XXXX 7890. PAN: ABCPM1234R.</p>

    <div class="section-title">PROPERTY:</div>
    <p>Agricultural land measuring <strong>20 Kanals</strong> (1,00,000 sq ft) at Khasra No. 890/1 to 890/5,
    Village Mattan, Tehsil Mattan, District Anantnag.
    Apple orchards on 12 kanals. Bounded by: North - National Highway, South - Lidder River,
    East - Shrine Board Land, West - Village common land.</p>

    <div class="section-title">SALE CONSIDERATION:</div>
    <p>Total: <strong>Rs. 1,80,00,000/-</strong> (Rupees One Crore Eighty Lakhs Only).</p>
    <ul>
        <li>Rs. 30,00,000/- by DD No. 234567 dt. 10/03/2026 (J&amp;K Bank)</li>
        <li>Rs. 50,00,000/- by RTGS Ref: JKBK2026031500890 dt. 15/03/2026</li>
        <li>Rs. 1,00,00,000/- by RTGS Ref: JKBK2026032000456 dt. 20/03/2026</li>
    </ul>

    <div class="section-title">SOURCE OF FUNDS AFFIDAVIT:</div>
    <div class="noc-box">
        <strong>AFFIDAVIT</strong><br><br>
        I, Faisal Rashid Mir, do solemnly affirm and state:<br><br>
        1. The funds for purchase are from family savings and agricultural income.<br>
        2. My family has been engaged in apple trade for over 20 years.<br>
        3. The funds are legitimate and not from any illegal source.<br>
        4. I am purchasing for personal agricultural use.<br><br>
        Deponent: Sd/- Faisal Rashid Mir<br>
        Verified at Anantnag on 18/03/2026<br>
        Before me: Notary Public, Anantnag (Seal)
    </div>

    <div class="page-break"></div>

    <div class="section-title">COVENANTS:</div>
    <div class="clause"><span class="clause-num">1.</span> The Vendor warrants clear and marketable title free from all encumbrances.</div>
    <div class="clause"><span class="clause-num">2.</span> The Vendor has obtained all necessary clearances for this transfer.</div>
    <div class="clause"><span class="clause-num">3.</span> Physical possession delivered to the Vendee on date of registration.</div>
    <div class="clause"><span class="clause-num">4.</span> All future property taxes and levies shall be borne by the Vendee.</div>

    <div class="witnesses">
        <div class="section-title">WITNESSES:</div>
        <p>1. Shri Javaid Ahmad Rather, S/o Habibullah Rather, R/o Mattan (Shopkeeper)</p>
        <p>2. Shri Showkat Ahmad Bhat, S/o Abdul Rashid Bhat, R/o Khanabal (Teacher)</p>
    </div>

    <div class="signature-block">
        <div class="sig"><div class="sig-line"></div>Sd/- Ghulam Nabi Bhat<br><em>(VENDOR)</em></div>
        <div class="sig"><div class="sig-line"></div>Sd/- Faisal Rashid Mir<br><em>(VENDEE - Student, Age 22)</em></div>
    </div>
    """
    save_html(output_dir, '03-benami-transaction.html', 'Benami Transaction', content)


def generate_jk_fraud_04(output_dir):
    """Government/Roshni land"""
    content = f"""
    {stamp_header(75000, random.randint(10000000, 99999999))}
    {reg_box('3456/2025', '15/11/2025', 'Srinagar-II')}
    <div class="clear"></div>

    <div class="doc-title">SALE DEED</div>
    <div class="doc-subtitle">(Immovable Property - Dal Lake Area)</div>

    <p>Executed on <strong>15th November 2025</strong> at SRO Srinagar-II.</p>

    <div class="section-title">PARTIES:</div>
    <p><strong>VENDOR:</strong> Shri Abdul Majeed Wani, S/o Late Habibullah Wani, Age: 58,
    Occupation: Businessman, R/o Dalgate, Srinagar - 190001. Aadhaar: 4567 XXXX 8901.</p>

    <p><strong>VENDEE:</strong> Shri Pradeep Kumar Bhat, S/o Shri T.N. Bhat, Age: 45,
    Occupation: Hotel Owner, R/o Boulevard Road, Srinagar - 190001. Aadhaar: 7890 XXXX 1234.</p>

    <div class="section-title">PROPERTY:</div>
    <p>Land measuring <strong>5 Kanals</strong> at Survey No. 123/4, 123/5, on the banks of Dal Lake,
    Nehru Park area, Tehsil Khanyar, District Srinagar.
    Existing structures: commercial houseboat parking and tourist facility.</p>

    <div class="section-title">TITLE CLAIM:</div>
    <div class="clause"><span class="clause-num">1.</span> Occupation since 1985 (over 37 years continuous possession)</div>
    <div class="clause"><span class="clause-num">2.</span> <strong>J&amp;K State Lands (Vesting of Ownership to Occupants) Act, 2001 ("Roshni Act")</strong> - Allotment Order No. ROSHNI/SGR/2004/789 dated 20/06/2004</div>
    <div class="clause"><span class="clause-num">3.</span> Revenue records showing Vendor as occupant since 1990</div>
    <div class="clause"><span class="clause-num">4.</span> Property tax paid to SMC since 2005</div>
    <p><em>Note: Original ownership documents from pre-1985 stated as "lost/destroyed during turmoil."
    Duplicate revenue entries obtained in 2001.</em></p>

    <div class="section-title">CONSIDERATION:</div>
    <p><strong>Rs. 2,50,00,000/-</strong> (Rupees Two Crore Fifty Lakhs Only).
    Paid via RTGS and demand drafts, Oct-Nov 2025.</p>

    <div class="section-title">COVENANTS:</div>
    <div class="clause"><span class="clause-num">1.</span> Vendor warrants title based on long possession and Roshni Act allotment.</div>
    <div class="clause"><span class="clause-num">2.</span> Vendor declares no pending litigation.</div>
    <div class="clause"><span class="clause-num">3.</span> Possession handed over.</div>

    <div class="witnesses">
        <div class="section-title">WITNESSES:</div>
        <p>1. Shri Farooq Ahmad Shah, R/o Dalgate, Srinagar</p>
        <p>2. Shri Ashok Kumar, R/o Boulevard Road, Srinagar</p>
    </div>

    <div class="signature-block">
        <div class="sig"><div class="sig-line"></div>Sd/- Abdul Majeed Wani<br><em>(VENDOR)</em></div>
        <div class="sig"><div class="sig-line"></div>Sd/- Pradeep Kumar Bhat<br><em>(VENDEE)</em></div>
    </div>
    """
    save_html(output_dir, '04-government-land-roshni.html', 'Roshni Act Land', content)


def generate_ka_fraud_01(output_dir):
    """Agricultural land sold as layout plots without conversion"""
    content = f"""
    {stamp_header(25000, random.randint(10000000, 99999999), state='Karnataka')}
    {reg_box('12456/2026', '10/03/2026', 'Ramanagara')}
    <div class="clear"></div>

    <div class="doc-title">AGREEMENT OF SALE</div>
    <div class="doc-subtitle">(For Residential Layout Plots - Green Valley Phase 2)</div>

    <p>Executed on <strong>10th March 2026</strong> at Ramanagara, Karnataka.</p>

    <div class="section-title">PARTIES:</div>
    <p><strong>VENDOR/DEVELOPER:</strong> M/s Green Valley Layouts, Partnership Firm, through Managing Partner
    Shri Venkatesh Gowda K.R., S/o Late Rangaiah Gowda, Age: 48,
    R/o #234, 5th Cross, Bidadi Town, Ramanagara - 562109. PAN: AAFFG5678P.</p>

    <p><strong>VENDEE:</strong> Shri Prashanth Kumar M., S/o Shri Manjunath B., Age: 34,
    Occupation: IT Professional, R/o #56, BTM Layout, Bengaluru - 560076.
    Aadhaar: 5678 XXXX 9012. PAN: BCKPP4567R.</p>

    <div class="section-title">PROPERTY:</div>
    <p>Plot No. 45, measuring <strong>30 ft x 40 ft (1,200 sq ft)</strong> in "Green Valley Phase-2 Layout",
    Survey No. 67/2, 67/3, Hoskote Village, Bidadi Hobli, Ramanagara Taluk, Karnataka.</p>
    <p>Total layout: 2 Acres divided into 52 residential plots.<br>
    <strong>Layout Approval: Bidadi Town Panchayat Resolution No. BTP/2025/Layout/34 dated 15/09/2025.</strong></p>

    <div class="section-title">REVENUE RECORDS (RTC/PAHANI):</div>
    <p>RTC Extract for Sy. No. 67/2, 67/3:<br>
    - <strong>Land Type: Agricultural (Tari/Garden land - Coconut and Arecanut)</strong><br>
    - Khata No: 89, Hissa No: 2, 3<br>
    - Owner: Venkatesh Gowda K.R. (Sale Deed 2020)<br>
    - Extent: 2 Acres 5 Guntas<br>
    - Land Revenue: Rs. 450/year (paid up to 2025-26)</p>

    <div class="section-title">APPROVALS:</div>
    <div class="clause"><span class="clause-num">1.</span> Gram Panchayat Layout Approval: BTP/2025/Layout/34</div>
    <div class="clause"><span class="clause-num">2.</span> DC Land Use Conversion Order (Sec 95, KLR Act): <em>Application pending</em></div>
    <div class="clause"><span class="clause-num">3.</span> BMRDA/BDA Approval: <em>"Not applicable for this area" - as per Developer</em></div>

    <div class="section-title">CONSIDERATION:</div>
    <p>Rate: Rs. 2,500/sq ft. Total: <strong>Rs. 30,00,000/-</strong>.<br>
    Advance: Rs. 5,00,000/- (Receipt No. GVL/2025/R/567). Balance on registration.</p>

    <div class="witnesses">
        <div class="section-title">WITNESSES:</div>
        <p>1. Shri Ramesh N., R/o Bidadi (Real Estate Agent)</p>
        <p>2. Shri Suresh Kumar, R/o Ramanagara (Firm Accountant)</p>
    </div>

    <div class="signature-block">
        <div class="sig"><div class="sig-line"></div>Sd/- Venkatesh Gowda K.R.<br><em>(DEVELOPER)</em></div>
        <div class="sig"><div class="sig-line"></div>Sd/- Prashanth Kumar M.<br><em>(VENDEE)</em></div>
    </div>
    """
    save_html(output_dir, '01-agricultural-land-conversion-fraud.html', 'Agri Land Conversion Fraud', content)


def generate_ka_fraud_02(output_dir):
    """Scheduled Tribe land sale in Kodagu"""
    content = f"""
    {stamp_header(15000, random.randint(10000000, 99999999), state='Karnataka')}
    {reg_box('2345/2026', '05/02/2026', 'Madikeri')}
    <div class="clear"></div>

    <div class="doc-title">SALE DEED</div>
    <div class="doc-subtitle">(Agricultural Land - Kodagu District)</div>

    <p>Executed on <strong>5th February 2026</strong> at SRO Madikeri, Kodagu District, Karnataka.</p>

    <div class="section-title">PARTIES:</div>
    <p><strong>VENDOR:</strong> Shri Appaiah B., S/o Late Biddaiah, Age: 55,
    <u>Caste: Jenu Kuruba (Scheduled Tribe)</u>, Occupation: Agriculturist,
    R/o Hoskeri Village, Somwarpet Taluk, Kodagu - 571236.
    <strong>ST Certificate: REV/KDG/ST/2010/456.</strong> Aadhaar: 2345 XXXX 6789.</p>

    <p><strong>VENDEE:</strong> Shri Deepak Agarwal, S/o Shri Ramesh Agarwal, Age: 40,
    Occupation: Coffee Estate Owner, R/o #12, MG Road, Madikeri - 571201.
    Aadhaar: 8901 XXXX 3456. PAN: AAKPA5678Q.</p>

    <div class="section-title">PROPERTY:</div>
    <p>Agricultural land measuring <strong>3 Acres 20 Guntas</strong> at Survey No. 89/1, 89/2,
    Hoskeri Village, Somwarpet Taluk, Kodagu District.
    Land Type: Coffee plantation with pepper vines. RTC Khata No: 67.</p>

    <div class="section-title">LAND GRANT HISTORY:</div>
    <p>This land was <strong>originally granted</strong> to the Vendor's father under the
    <strong>Karnataka Land Reforms Act, 1961</strong> vide Grant Certificate No. LR/KDG/1978/234
    dated 15/08/1978 by the Land Tribunal, Somwarpet - specifically for
    landless Scheduled Tribe beneficiary for agricultural livelihood.</p>

    <div class="section-title">RELEASE CERTIFICATE:</div>
    <div class="noc-box">
        <strong>OFFICE OF THE ASSISTANT COMMISSIONER, MADIKERI</strong><br>
        No: AC/MDK/REL/2025/89 &emsp; Date: 20/12/2025<br><br>
        Sub: Release Certificate under PTCL Act 1978 for Sy. 89/1, 89/2 Hoskeri<br><br>
        After verifying that 45 years have elapsed since the original grant, and the grantee family
        has been in continuous possession, this certificate is issued permitting transfer.<br><br>
        Sd/-<br>
        Assistant Commissioner (Revenue), Kodagu Division
    </div>

    <div class="section-title">CONSIDERATION:</div>
    <p><strong>Rs. 18,00,000/-</strong> (Rupees Eighteen Lakhs Only). Paid via NEFT.</p>

    <div class="witnesses">
        <div class="section-title">WITNESSES:</div>
        <p>1. Shri Muthappa K., R/o Hoskeri Village, Somwarpet</p>
        <p>2. Shri Sunil B.M., R/o Kushalnagar, Kodagu</p>
    </div>

    <div class="signature-block">
        <div class="sig"><div class="sig-line"></div>Sd/- Appaiah B.<br><em>(VENDOR - ST)</em></div>
        <div class="sig"><div class="sig-line"></div>Sd/- Deepak Agarwal<br><em>(VENDEE)</em></div>
    </div>
    """
    save_html(output_dir, '02-scheduled-tribe-land-sale.html', 'ST Land Sale - Kodagu', content)


def generate_jk_legit_01(output_dir):
    """Properly registered sale deed - fully compliant"""
    content = f"""
    {stamp_header(120000, random.randint(10000000, 99999999))}
    {reg_box('8827/2026', '25/03/2026', 'Jammu-I', book='1', vol='567')}
    <div class="clear"></div>

    <div class="doc-title">REGISTERED SALE DEED</div>
    <div class="doc-subtitle">(Under Section 17 of the Registration Act, 1908)</div>

    <p>This Deed of Sale is made and executed on this <strong>25th day of March, 2026</strong>
    (Execution Date: 25/03/2026) at the office of the Sub-Registrar, Jammu-I,
    District Jammu, Union Territory of Jammu &amp; Kashmir.</p>

    <div class="section-title">PARTIES:</div>
    <p><strong>VENDOR:</strong> Shri Rajinder Singh Chib, S/o Shri Baldev Singh Chib, Age: 55,
    Occupation: Retired Army Officer (Retd. Colonel), R/o Quarter No. 12, Officers Enclave,
    Talab Tillo, Jammu - 180002. Aadhaar: 6789 XXXX 2345. PAN: AAKPC5678L.
    <em>Present before Sub-Registrar with original documents and biometric verification.</em></p>

    <p><strong>VENDEE:</strong> Smt. Neelam Kumari, W/o Shri Vikram Gupta, Age: 38,
    Occupation: Software Engineer, R/o Flat 4B, Shivalik Heights, Channi Himmat,
    Jammu - 180015. Aadhaar: 2345 XXXX 6789. PAN: BFJPK4567M.
    <em>Present before Sub-Registrar with biometric verification.</em></p>

    <div class="section-title">SCHEDULE OF PROPERTY:</div>
    <p>Residential plot measuring <strong>8 Marlas (2,178 sq ft)</strong> with constructed house
    (Ground + First Floor, total built-up: 3,200 sq ft) at:<br>
    Khasra No: 456/2, Khata No: 123, Khewat No: 89<br>
    Ward No: 15, Mohalla Rehari Colony, Tehsil Jammu South, District Jammu.<br>
    Municipal House No: R-234, Property ID: JMC/2019/R/5678</p>
    <p>Boundaries:<br>
    North: 20 ft wide municipal road | South: Property of Shri Romesh Chander (R-235)<br>
    East: Property of Smt. Kamla Devi (R-233) | West: 10 ft wide lane</p>

    <div class="page-break"></div>

    <div class="section-title">CONSIDERATION &amp; STAMP DUTY:</div>
    <p>Sale Consideration: <strong>Rs. 1,20,00,000/-</strong> (One Crore Twenty Lakhs)<br>
    Circle Rate Value: Rs. 1,15,00,000/- (per Collector Rate 2025-26)<br>
    <strong>Stamp Duty Paid: Rs. 1,20,000/- (5% + 1% cess)</strong><br>
    Registration Fee: Rs. 12,000/- (1%)<br><br>
    Payment: RTGS Ref: HDFC2026032000123 - Rs. 1,20,00,000/-<br>
    TDS u/s 194-IA: Rs. 1,20,000/- deposited (Challan: BSR/JMU/2026/4567)</p>

    <div class="section-title">TITLE CHAIN:</div>
    <div class="clause"><span class="clause-num">1.</span> JDA Allotment Letter No. JDA/ALT/1995/789 dt. 12/05/1995 (to Vendor's father)</div>
    <div class="clause"><span class="clause-num">2.</span> Mutation Order No. 567/2018 dt. 10/08/2018 (Legal Heir Certificate: LHC/JMU/2018/234)</div>
    <div class="clause"><span class="clause-num">3.</span> Building Plan: JMC/BP/2005/456 | Completion Certificate: JMC/CC/2007/123</div>

    <div class="section-title">ENCUMBRANCE CERTIFICATE:</div>
    <p>EC No: SRO-JMU-I/EC/2026/890 for <strong>30 years</strong> (01/01/1996 to 25/03/2026) - <strong>CLEAR</strong>.
    No encumbrances, mortgages, liens, or pending litigation.</p>

    <div class="section-title">DECLARATIONS:</div>
    <div class="clause"><span class="clause-num">1.</span> Vendor declares absolute ownership with marketable title.</div>
    <div class="clause"><span class="clause-num">2.</span> Property free from all encumbrances, disputes, and acquisition.</div>
    <div class="clause"><span class="clause-num">3.</span> All property taxes, water/electricity charges paid till date.</div>
    <div class="clause"><span class="clause-num">4.</span> Vendor indemnifies Vendee against all future claims.</div>
    <div class="clause"><span class="clause-num">5.</span> Physical possession handed over on registration date.</div>

    <div class="witnesses">
        <div class="section-title">WITNESSES:</div>
        <p>1. Shri Arun Sharma, R/o Rehari Colony, Jammu (Aadhaar: 4567 XXXX 8901)</p>
        <p>2. Smt. Poonam Gupta, R/o Channi Himmat, Jammu (Aadhaar: 7890 XXXX 1234)</p>
    </div>

    <div class="signature-block">
        <div class="sig"><div class="sig-line"></div>Sd/- Col. Rajinder Singh Chib (Retd.)<br><em>(VENDOR)</em></div>
        <div class="sig"><div class="sig-line"></div>Sd/- Smt. Neelam Kumari<br><em>(VENDEE)</em></div>
    </div>

    <div style="margin-top: 30px; border-top: 2px solid #000; padding-top: 10px;">
        <strong>REGISTRATION ENDORSEMENT:</strong><br>
        Registered after biometric verification of both parties, examination of original documents,
        and payment of all statutory duties. Doc No. 8827/2026, Book-I, Volume 567.<br><br>
        <strong>Sd/- Sub-Registrar, Jammu-I</strong><br>
        Seal &amp; Date: 25/03/2026
    </div>
    """
    save_html(output_dir, '01-registered-sale-deed.html', 'Registered Sale Deed - Jammu', content)


def generate_ka_legit_01(output_dir):
    """Fully compliant registered sale deed in Bangalore"""
    content = f"""
    {stamp_header(250000, random.randint(10000000, 99999999), state='Karnataka')}
    {reg_box('34567/2026', '18/03/2026', 'Bengaluru South', book='1', vol='890')}
    <div class="clear"></div>

    <div class="doc-title">SALE DEED (REGISTERED)</div>
    <div class="doc-subtitle">(Executed under Registration Act 1908 &amp; Transfer of Property Act 1882)</div>

    <p>This Deed of Sale executed on <strong>18th March 2026</strong> at SRO Bengaluru South.</p>

    <div class="section-title">PARTIES:</div>
    <p><strong>VENDOR:</strong> Shri Narayana Murthy H.R., S/o Late Shri Rangaswamy H., Age: 60,
    Occupation: Retired Bank Manager, R/o #78, JP Nagar 2nd Phase, Bengaluru - 560078.
    Aadhaar: 3456 XXXX 7890. PAN: AANPM5678K. Biometric verified.</p>

    <p><strong>VENDEE:</strong> Smt. Priya Ramesh, W/o Shri Ramesh S., Age: 42,
    Occupation: Doctor (MBBS, MD), R/o #23, Jayanagar 4th Block, Bengaluru - 560041.
    Aadhaar: 8901 XXXX 2345. PAN: BCRPR6789M. Biometric verified.</p>

    <div class="section-title">SCHEDULE OF PROPERTY:</div>
    <p>Site No: 234, measuring <strong>40 ft x 60 ft (2,400 sq ft)</strong> with G+2 house (4,800 sq ft built-up)<br>
    4th Main Road, BDA Layout, JP Nagar 5th Phase<br>
    Survey No: 45/1, Ward No: 177, Bengaluru South Taluk<br>
    BBMP Property ID: BBM/JS/2019/PID-45678<br>
    <strong>Khata No: A-5678 (A-Khata)</strong>, BBMP Zone: South</p>
    <p>Boundaries: East - 40ft BDA Road | West - Site 235 | North - Site 220 | South - 30ft Cross Road</p>

    <div class="page-break"></div>

    <div class="section-title">TITLE CHAIN:</div>
    <div class="clause"><span class="clause-num">1.</span> BDA Allotment: BDA/JP5/ALT/1992/567 dated 20/05/1992 (Vendor's father)</div>
    <div class="clause"><span class="clause-num">2.</span> BDA Sale Deed: Doc No. 12345/1994, SRO Jayanagar dt. 15/03/1994</div>
    <div class="clause"><span class="clause-num">3.</span> Khata Transfer: BBMP/KHT/2015/7890 dt. 10/09/2015 (via Legal Heir Certificate)</div>
    <div class="clause"><span class="clause-num">4.</span> Building Plan: BBMP/BP/2016/1234 | OC: BBMP/OC/2018/567</div>

    <div class="section-title">ENCUMBRANCE CERTIFICATE:</div>
    <p>EC No: SRO-BLR-S/EC/2026/4567 for <strong>34 years</strong> (1992-2026) - <strong>CLEAR</strong>. No encumbrances.</p>

    <div class="section-title">CONSIDERATION &amp; DUTIES:</div>
    <p>Sale Consideration: <strong>Rs. 2,40,00,000/-</strong> (Two Crore Forty Lakhs)<br>
    Guidance Value: Rs. 2,16,00,000/- (2,400 sq ft x Rs. 9,000/sq ft)<br>
    <strong>Stamp Duty: Rs. 12,00,000/- (5%)</strong> | Cess: Rs. 2,40,000/- (1%) | Reg Fee: Rs. 30,000/-<br>
    Total Govt Dues: Rs. 14,70,000/-<br><br>
    Payment: RTGS ICICBLR2026031800789 - Rs. 2,40,00,000/-<br>
    TDS 194-IA: Rs. 2,40,000/- (CRN/BLR/2026/8901)</p>

    <div class="section-title">COVENANTS:</div>
    <div class="clause"><span class="clause-num">1.</span> Clear marketable title warranted.</div>
    <div class="clause"><span class="clause-num">2.</span> Free from encumbrances and litigation.</div>
    <div class="clause"><span class="clause-num">3.</span> All taxes paid. Original documents handed over.</div>
    <div class="clause"><span class="clause-num">4.</span> Vendor to assist in Khata transfer &amp; BBMP mutation.</div>
    <div class="clause"><span class="clause-num">5.</span> Vendor indemnifies against all future claims.</div>

    <div class="witnesses">
        <div class="section-title">WITNESSES:</div>
        <p>1. Shri Manjunath K., R/o JP Nagar (Aadhaar: 1234 XXXX 5678)</p>
        <p>2. Smt. Geetha B.S., R/o Jayanagar (Aadhaar: 6789 XXXX 0123)</p>
    </div>

    <div class="signature-block">
        <div class="sig"><div class="sig-line"></div>Sd/- H.R. Narayana Murthy<br><em>(VENDOR)</em></div>
        <div class="sig"><div class="sig-line"></div>Sd/- Dr. Priya Ramesh<br><em>(VENDEE)</em></div>
    </div>

    <div style="margin-top: 30px; border-top: 2px solid #000; padding-top: 10px;">
        <strong>REGISTRATION ENDORSEMENT:</strong><br>
        Biometric verified. All original documents examined. Statutory duties paid in full.
        Doc No. 34567/2026, Book-I, Vol 890.<br>
        <strong>Sd/- Sub-Registrar, Bengaluru South | Seal | 18/03/2026</strong>
    </div>
    """
    save_html(output_dir, '01-registered-sale-deed.html', 'Registered Sale Deed - Bangalore', content)


def main():

    base = os.path.dirname(os.path.abspath(__file__))

    # Fraudulent
    print("\n=== Generating Fraudulent Documents (J&K) ===")
    jk_fraud = os.path.join(base, 'fraudulent', 'jammu-kashmir')
    generate_jk_fraud_01(jk_fraud)
    generate_jk_fraud_02(jk_fraud)
    generate_jk_fraud_03(jk_fraud)
    generate_jk_fraud_04(jk_fraud)
    generate_ec(jk_fraud, fraud=True)
    generate_tax_receipt(jk_fraud, fraud=True)
    generate_title_chain(jk_fraud, fraud=True)
    generate_mutation(jk_fraud, fraud=True)
    generate_oc(jk_fraud, fraud=True)
    generate_building_plan(jk_fraud, fraud=True)
    generate_roshni_status(jk_fraud, fraud=True)

    print("\n=== Generating Fraudulent Documents (Karnataka) ===")
    ka_fraud = os.path.join(base, 'fraudulent', 'karnataka')
    generate_ka_fraud_01(ka_fraud)
    generate_ka_fraud_02(ka_fraud)
    generate_ec(ka_fraud, fraud=True)
    generate_tax_receipt(ka_fraud, fraud=True)
    generate_title_chain(ka_fraud, fraud=True)
    generate_mutation(ka_fraud, fraud=True)
    generate_oc(ka_fraud, fraud=True)
    generate_building_plan(ka_fraud, fraud=True)
    generate_roshni_status(ka_fraud, fraud=True)

    # Legitimate
    print("\n=== Generating Legitimate Documents (J&K) ===")
    jk_legit = os.path.join(base, 'legitimate', 'jammu-kashmir')
    generate_jk_legit_01(jk_legit)
    generate_ec(jk_legit, fraud=False)
    generate_tax_receipt(jk_legit, fraud=False)
    generate_title_chain(jk_legit, fraud=False)
    generate_mutation(jk_legit, fraud=False)
    generate_oc(jk_legit, fraud=False)
    generate_building_plan(jk_legit, fraud=False)
    generate_roshni_status(jk_legit, fraud=False)

    print("\n=== Generating Legitimate Documents (Karnataka) ===")
    ka_legit = os.path.join(base, 'legitimate', 'karnataka')
    generate_ka_legit_01(ka_legit)
    generate_ec(ka_legit, fraud=False)
    generate_tax_receipt(ka_legit, fraud=False)
    generate_title_chain(ka_legit, fraud=False)
    generate_mutation(ka_legit, fraud=False)
    generate_oc(ka_legit, fraud=False)
    generate_building_plan(ka_legit, fraud=False)
    generate_roshni_status(ka_legit, fraud=False)

    print(f"\n All PDF documents generated in: {base}")
    print("\nAll HTML files have been automatically deleted.")
    print("PDFs are ready for upload to Landshield for testing!")


# --- Additional Document Generators ---
def generate_ec(output_dir, fraud=False):
    title = "Encumbrance Certificate (EC)"
    status = "No encumbrances found in last 30 years." if not fraud else "Property mortgaged to NBFC, EC not clear."
    content = f"""
    <div class='doc-title'>ENCUMBRANCE CERTIFICATE</div>
    <div class='doc-subtitle'>(EC for Property)</div>
    <div class='section-title'>Details</div>
    <p>Survey/Khasra: 456/2 | Owner: Example Name<br>Period: 01/01/1996 to 16/05/2026</p>
    <div class='section-title'>Status</div>
    <p>{status}</p>
    """
    save_html(output_dir, '02-ec.html', title, content)

def generate_tax_receipt(output_dir, fraud=False):
    title = "Property Tax Receipt"
    status = "All taxes paid up to date." if not fraud else "Outstanding dues for 2025-26."
    content = f"""
    <div class='doc-title'>PROPERTY TAX RECEIPT</div>
    <div class='section-title'>Details</div>
    <p>Property ID: JMC/2019/R/5678<br>Owner: Example Name</p>
    <div class='section-title'>Status</div>
    <p>{status}</p>
    """
    save_html(output_dir, '03-tax-receipt.html', title, content)

def generate_title_chain(output_dir, fraud=False):
    title = "Title Deed / Chain of Ownership"
    status = "Clear chain: Allotment → Mutation → Sale Deed." if not fraud else "Discrepancy in mutation entry for 2018."
    content = f"""
    <div class='doc-title'>TITLE DEED / CHAIN OF OWNERSHIP</div>
    <div class='section-title'>Chain</div>
    <p>{status}</p>
    """
    save_html(output_dir, '04-title-chain.html', title, content)

def generate_mutation(output_dir, fraud=False):
    title = "Mutation / Khata Transfer Record"
    status = "Mutation completed and updated in revenue records." if not fraud else "Mutation not reflected in latest records."
    content = f"""
    <div class='doc-title'>MUTATION / KHATA TRANSFER</div>
    <div class='section-title'>Status</div>
    <p>{status}</p>
    """
    save_html(output_dir, '05-mutation.html', title, content)

def generate_oc(output_dir, fraud=False):
    title = "Occupancy Certificate (OC)"
    status = "OC issued by local authority." if not fraud else "OC not issued, construction unauthorized."
    content = f"""
    <div class='doc-title'>OCCUPANCY CERTIFICATE</div>
    <div class='section-title'>Status</div>
    <p>{status}</p>
    """
    save_html(output_dir, '06-oc.html', title, content)

def generate_building_plan(output_dir, fraud=False):
    title = "Building Plan / Layout Approval"
    status = "Plan approved by authority." if not fraud else "No approval found for layout/building."
    content = f"""
    <div class='doc-title'>BUILDING PLAN / LAYOUT APPROVAL</div>
    <div class='section-title'>Status</div>
    <p>{status}</p>
    """
    save_html(output_dir, '07-building-plan.html', title, content)

def generate_roshni_status(output_dir, fraud=False):
    title = "Roshni Act Status Check"
    status = "Not applicable / No claim." if not fraud else "Land under Roshni Act investigation."
    content = f"""
    <div class='doc-title'>ROSHNI ACT STATUS CHECK</div>
    <div class='section-title'>Status</div>
    <p>{status}</p>
    """
    save_html(output_dir, '08-roshni-status.html', title, content)


if __name__ == '__main__':
    main()
