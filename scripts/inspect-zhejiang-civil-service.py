from pathlib import Path

import pandas as pd

for path in sorted(Path(r"C:\Users\dell\Desktop").glob("*浙江省各级机关单位公务员招考计划一览表.xlsx")):
    print("FILE", path.name)
    excel = pd.ExcelFile(path)
    print("SHEETS", excel.sheet_names)
    for sheet in excel.sheet_names[:3]:
        raw = pd.read_excel(path, sheet_name=sheet, header=None, nrows=8, dtype=str)
        print("SHEET", sheet, raw.shape)
        print(raw.head(6).to_string())
