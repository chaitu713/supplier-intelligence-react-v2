import pandas as pd

###################################################
# CLEAN SUPPLIERS
###################################################

suppliers = pd.read_csv("data/suppliers_v2.csv")

suppliers = suppliers.drop_duplicates(subset=["supplier_id"])

suppliers.to_csv("data/suppliers_v2.csv", index=False)

print("Suppliers duplicates removed")

###################################################
# CLEAN ESG
###################################################

for esg_file in [
    "data/esg_environmental_v2.csv",
    "data/esg_social_v2.csv",
    "data/esg_governance_v2.csv",
]:
    esg = pd.read_csv(esg_file)
    esg = esg.drop_duplicates(subset=["supplier_id"])
    esg.to_csv(esg_file, index=False)

print("ESG duplicates removed")

###################################################
# CLEAN TRANSACTIONS
###################################################

transactions = pd.read_csv("data/transactions_v2.csv")

transactions = transactions.drop_duplicates(subset=["transaction_id"])

transactions.to_csv("data/transactions_v2.csv", index=False)

print("Transaction duplicates removed")
