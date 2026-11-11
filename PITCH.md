# Haat: the pitch

**The problem.** A retail chain that has only ever sold in shops is going online across India.
Online, the worst thing it can do is sell an item that is not there. Shoppers also give up quickly
if search cannot cope with a typo.

**What we built.** Haat is a working online store. You pick your city, search and browse what that
city's shops have in stock, add to a cart and place an order. The count on every stock tag is live:
when anyone checks out, tags on every open page change by themselves.

**How the three Aiven services carry it**

- **PostgreSQL is the memory.** Products, carts, orders and stock per city. At checkout one
  transaction reserves the stock with a conditional update, so two buyers can never both get the
  last unit. Constraints on the table would refuse an oversell even if our code did not.
- **Kafka is the nervous system.** Placing an order produces `order.placed`. Three consumers react
  independently: one commits the shelf count, one records the customer's confirmation, one keeps
  search in sync. Replays are harmless, failures are retried, and an outbox sweep catches orders
  whose event did not make it out.
- **OpenSearch is the search bar.** Typo tolerant, filtered by category, price and city, with
  suggestions as you type. `bluetoth earphnes` finds Bluetooth earphones.

**See it for yourself.** The Ledger page streams every write, event, consumer step and index
update as it happens. Press "Run the race" and fifty buyers go after one unit at the same moment.
One wins, forty nine are turned away, and the tag on an open product page flips to Sold out.

**Why it is different.** We did not stop at a catalogue that works. The interface is built around
one idea from the world of shops, the stock tag, and the system is built so the number on that
tag can be trusted.

**Tech.** Node and Express, plain ES modules on the front end, Aiven for PostgreSQL, Apache Kafka
and OpenSearch. Credentials are in environment variables only.
