from pyxlsb import open_workbook
import sys

file_path = './Dados da Coffee mais/VisãoHistórica KA (2).xlsb'

with open_workbook(file_path) as wb:
    with wb.get_sheet('PortalVendas') as sheet:
        count = 0
        for row in sheet.rows():
            if count == 0:
                 print("Headers:", [c.v for c in row if c.v is not None])
            if count == 5:
                 print("Row 5:", [c.v for c in row])
            count += 1
            if count > 5: break
