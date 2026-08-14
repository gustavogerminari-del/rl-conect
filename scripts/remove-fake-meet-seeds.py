from pathlib import Path
p = Path('src/services/dataService.ts')
t = p.read_text(encoding='utf-8')
t = t.replace("    link_reuniao: 'https://meet.google.com/abc-defg-hij',\n", "")
t = t.replace("    link_reuniao: 'https://meet.google.com/xyz-uvwx-rst',\n", "")
t = t.replace("    sincronizado_gcal: true,\n", "    sincronizado_gcal: false,\n", 2)
p.write_text(t, encoding='utf-8')
print('Fake Meet seed links removed.')
