import pandas as pd
import random
from faker import Faker

fake = Faker()

############################
# SUPPLIERS DATA
############################

suppliers = []

for i in range(1,201):

    suppliers.append({
        "supplier_id": i,
        "supplier_name": fake.company(),
        "country": random.choice(["India","China","Vietnam","Germany","USA"]),
        "category": random.choice(["Raw Material","Electronics","Packaging","Chemicals"]),
        "onboarding_date": fake.date_between(start_date='-5y', end_date='today'),
        "certification": random.choice(["ISO9001","ISO14001","ESG Certified","None"])
    })

suppliers_df = pd.DataFrame(suppliers)

############################
# ESG METRICS
############################

esg = []

for i in range(1,201):

    carbon = random.randint(20,300)
    water = random.randint(200,1500)
    labor = random.randint(0,5)

    esg.append({
        "supplier_id": i,
        "carbon_emission": carbon,
        "water_usage": water,
        "labor_violations": labor,
        "land_use_risk": random.choice(["Low","Medium","High"]),
        "esg_score": 100 - (carbon*0.1 + water*0.01 + labor*5)
    })

esg_df = pd.DataFrame(esg)

############################
# TRANSACTIONS
############################

transactions = []

for i in range(1,3001):

    supplier = random.randint(1,200)

    transactions.append({
        "transaction_id": i,
        "supplier_id": supplier,
        "order_value": random.randint(1000,100000),
        "delivery_delay_days": random.randint(0,20),
        "defect_rate": round(random.uniform(0,0.2),3),
        "cost_variance": round(random.uniform(-10,15),2)
    })

transactions_df = pd.DataFrame(transactions)

############################
# SAVE FILES
############################

suppliers_df.to_csv("data/suppliers_v2.csv",index=False)
esg_df.to_csv("data/esg_social_v2.csv",index=False)
transactions_df = transactions_df.rename(columns={"delivery_delay_days": "delay_days"})
transactions_df.to_csv("data/transactions_v2.csv",index=False)

print("All datasets generated successfully!")
