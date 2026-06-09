import sys

partners = [
  {"key": "13717 - SUPERMERCADO COELHO DINIZ LTDA", "net": 192150.87, "vendedor": "LUISA"},
  {"key": "31821 - DUFRY DO BRASIL DUTY FREE SHOP LTDA.", "net": 172900.00, "vendedor": "LUISA"},
  {"key": "210260 - LABORATORIO GREEN MEDICAL LTDA", "net": 83619.52, "vendedor": "EXPORTAÇÃO"},
  {"key": "202427 - SUPERMERCADOS ABC", "net": 50442.10, "vendedor": "LUISA"},
  {"key": "17160 - SUPERMERCADO SUPER LUNA S.A", "net": 46373.54, "vendedor": "LUISA"},
  {"key": "128316 - SUPERMERCADOS COMPER", "net": 13795.40, "vendedor": "LUISA"},
  {"key": "208163 - VARANDA FRUTAS E MERCEARIA LTDA", "net": 10912.00, "vendedor": "KEYACCOUNT"},
  {"key": "34107 - ORIUNDI SUPERMERCADOS", "net": 10160.36, "vendedor": "LUISA"},
  {"key": "22244 - COMERCIAL MONLEVADE", "net": 9128.76, "vendedor": "LUISA"},
  {"key": "210525 - NUTRIBOM EXPRESS", "net": 7700.00, "vendedor": "FERNANDA"},
  {"key": "65394 - COMPANHIA APOLO DE SUPERMERCADOS", "net": 6141.80, "vendedor": "LUISA"},
  {"key": "208167 - VARANDA FRUTAS E MERCEARIA LTDA", "net": 5456.00, "vendedor": "KEYACCOUNT"},
  {"key": "208171 - VARANDA FRUTAS E MERCEARIA LTDA", "net": 5456.00, "vendedor": "KEYACCOUNT"},
  {"key": "15559 - EMPORIUM SAO PAULO", "net": 3115.80, "vendedor": "KEYACCOUNT"},
  {"key": "208856 - SUELLEN GOMES", "net": 2788.80, "vendedor": "LUISA"},
  {"key": "22250 - CEREAIS MONLEVADE", "net": 2627.04, "vendedor": "LUISA"},
  {"key": "204009 - GABRIEL LEAL COLOZI", "net": 2099.80, "vendedor": "LUISA"},
  {"key": "208915 - JAZZ SIDE SERVICOS DE RESERVAS LTDA", "net": 1919.04, "vendedor": "LUISA"},
  {"key": "209012 - AM RACOES", "net": 1799.40, "vendedor": "FERNANDA"},
  {"key": "208159 - LE DEP BARRA DELICATESSEN LTDA", "net": 1775.36, "vendedor": "FERNANDA"},
  {"key": "208902 - ROBERTO MELO DA SILVA FILHO.", "net": 1699.70, "vendedor": "LUISA"},
  {"key": "211027 - BORGES E LEAL", "net": 1699.70, "vendedor": "FERNANDA"},
  {"key": "206136 - CASA DO QUEIJO BUONA TAVOLA", "net": 1487.48, "vendedor": "FERNANDA"},
  {"key": "209817 - GRANI SANI ALIMENTOS LTDA", "net": 1487.48, "vendedor": "FERNANDA"},
  {"key": "208905 - NATUFIT CANTINHO SAUDAVEL LTDA", "net": 1199.60, "vendedor": "FERNANDA"},
  {"key": "208291 - WTECH INDUSTRIA E COMERCIO LTDA", "net": 1199.60, "vendedor": "LUISA"},
  {"key": "208908 - MAIS 1 CAFE PRAIA DE BELAS", "net": 1199.60, "vendedor": "LUISA"},
  {"key": "209270 - AEC CONTACT CENTER", "net": 1199.60, "vendedor": "FERNANDA"},
  {"key": "209710 - HOTEL MANDINO", "net": 1199.60, "vendedor": "FERNANDA"},
  {"key": "211475 - LENILSON LIMA MOTA SUPERMERCADO LTDA", "net": 1199.60, "vendedor": "LUISA"},
  {"key": "211483 - LENILSON LIMA MOTA SUPERMERCADO LTDA", "net": 1199.60, "vendedor": "LUISA"},
  {"key": "208376 - INOVA CAFE E LANCHONETE - LTDA", "net": 1135.56, "vendedor": "FERNANDA"},
  {"key": "203843 - POPOLARE CUCINA ITALIANA", "net": 1049.90, "vendedor": "LUISA"},
  {"key": "210453 - FLORES E AMORES CAFETERIA LTDA", "net": 947.68, "vendedor": "FERNANDA"},
  {"key": "208867 - AMENO GELATO ARTESANAL", "net": 899.60, "vendedor": "LUISA"},
  {"key": "208924 - DECRIE - DESIGN EM MADEIRA LTDA", "net": 887.68, "vendedor": "FERNANDA"},
  {"key": "200376 - SCPREV", "net": 629.79, "vendedor": "LUISA"},
  {"key": "58952 - DORELLA LTDA", "net": 599.80, "vendedor": "FERNANDA"},
  {"key": "211526 - BFIT COM DE ARTS ESPORTIVOS LTDA", "net": 599.80, "vendedor": "FERNANDA"},
  {"key": "208783 - BERGONSO & CICHETTO LTDA", "net": 599.80, "vendedor": "FERNANDA"},
  {"key": "208872 - HELOISA PIRES GUNTHER", "net": 599.80, "vendedor": "LUISA"},
  {"key": "209038 - QUE TUTTI DE MINAS LTDA", "net": 599.80, "vendedor": "LUISA"},
  {"key": "209126 - FLOR DO DESERTO CAFETERIA LTDA", "net": 599.80, "vendedor": "LUISA"},
  {"key": "209144 - KIPOUS", "net": 599.80, "vendedor": "LUISA"},
  {"key": "209881 - REAL MTSC LTDA", "net": 599.80, "vendedor": "FERNANDA"},
  {"key": "211185 - NUHOUSE", "net": 599.80, "vendedor": "FERNANDA"},
  {"key": "207182 - MAGADU BAKERY", "net": 575.76, "vendedor": "FERNANDA"},
  {"key": "208357 - ASSOCIACAO DOS TRANSPORTADORES", "net": 575.76, "vendedor": "FERNANDA"},
  {"key": "120621 - JEFFERSON SILVA", "net": 179.90, "vendedor": "MELI"},
  {"key": "173594 - RAFAEL PELETEIRO", "net": 179.70, "vendedor": "MELI"},
  {"key": "160547 - FERNANDA SILVA", "net": 59.98, "vendedor": "FERNANDA"}
]

needed_total = 520381.70
needed_ka = 90848.36
tolerance = 1.0 # 1.00 BRL tolerance

# Sort descending
partners.sort(key=lambda x: x["net"], reverse=True)

# Precompute suffix sums for standard 0-1 subset sum
suffix_sums = [0] * (len(partners) + 1)
for i in range(len(partners) - 1, -1, -1):
    suffix_sums[i] = suffix_sums[i+1] + partners[i]["net"]

total_subsets = []

def find_total_subsets(idx, current_sum, selected_indices):
    if abs(current_sum - needed_total) <= tolerance:
        total_subsets.append(selected_indices.copy())
        return
    if idx == len(partners):
        return
    if current_sum > needed_total + tolerance:
        return
    if current_sum + suffix_sums[idx] < needed_total - tolerance:
        return

    # Include
    find_total_subsets(idx + 1, current_sum + partners[idx]["net"], selected_indices + [idx])
    # Exclude
    find_total_subsets(idx + 1, current_sum, selected_indices)

print("Stage 1: Finding subsets that sum to needed_total...")
find_total_subsets(0, 0.0, [])
print(f"Found {len(total_subsets)} subsets matching needed_total.")

# Stage 2: For each subset, search for a sub-subset that sums to needed_ka
matches = []

for s_idx, subset in enumerate(total_subsets):
    subset_partners = [partners[i] for i in subset]
    # Suffix sums for this subset
    sub_suffix = [0] * (len(subset_partners) + 1)
    for i in range(len(subset_partners) - 1, -1, -1):
        sub_suffix[i] = sub_suffix[i+1] + subset_partners[i]["net"]
    
    subset_matches = []
    
    def find_ka_subsets(idx, current_sum, selected_indices):
        if abs(current_sum - needed_ka) <= tolerance:
            subset_matches.append(selected_indices.copy())
            return
        if idx == len(subset_partners):
            return
        if current_sum > needed_ka + tolerance:
            return
        if current_sum + sub_suffix[idx] < needed_ka - tolerance:
            return
            
        # Include
        find_ka_subsets(idx + 1, current_sum + subset_partners[idx]["net"], selected_indices + [idx])
        # Exclude
        find_ka_subsets(idx + 1, current_sum, selected_indices)
        
    find_ka_subsets(0, 0.0, [])
    
    for match in subset_matches:
        matches.append((subset, [subset[i] for i in match]))

print(f"\nFound {len(matches)} exact combinations for both targets:")
for m in matches[:10]:
    total_idx, ka_idx = m
    tot_sum = sum(partners[i]["net"] for i in total_idx)
    ka_sum = sum(partners[i]["net"] for i in ka_idx)
    print(f"\nMatch: Total Sum = R$ {tot_sum:,.2f}, KA Sum = R$ {ka_sum:,.2f}")
    print("  KeyAccount Assigned:")
    for idx in ka_idx:
        print(f"    * {partners[idx]['key']} | Net: R$ {partners[idx]['net']:,.2f}")
    print("  Other Assigned:")
    for idx in total_idx:
        if idx not in ka_idx:
            print(f"    * {partners[idx]['key']} | Net: R$ {partners[idx]['net']:,.2f}")
