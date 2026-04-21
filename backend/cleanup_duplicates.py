import pandas as pd

###################################################
# CLEAN SUPPLIERS
###################################################

suppliers = pd.read_csv("data/suppliers.csv")

suppliers = suppliers.drop_duplicates(subset=["supplier_id"])

suppliers.to_csv("data/suppliers.csv", index=False)

print("Suppliers duplicates removed")

###################################################
# CLEAN ESG
###################################################

esg = pd.read_csv("data/esg_metrics.csv")

esg = esg.drop_duplicates(subset=["supplier_id"])

esg.to_csv("data/esg_metrics.csv", index=False)

print("ESG duplicates removed")

###################################################
# CLEAN TRANSACTIONS
###################################################

transactions = pd.read_csv("data/transactions.csv")

transactions = transactions.drop_duplicates(subset=["transaction_id"])

transactions.to_csv("data/transactions.csv", index=False)

print("Transaction duplicates removed")