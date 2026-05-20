SO.TE.CO ERP - Installation client (Windows)
============================================

Livraison
---------

Le seul fichier a remettre au client :
  installer-to-deliver\SO.TE.CO-ERP-Setup-<version>.exe

Tout est inclus dedans (Node, PostgreSQL embarque, code applicatif).
Le poste client n'a besoin d'aucun prerequis - ni Node, ni PostgreSQL,
ni administrateur, ni invite de commandes.

Installation
------------

1. Le client double-clique sur SO.TE.CO-ERP-Setup-<version>.exe
2. L'assistant Windows s'ouvre, Suivant -> Installer
3. L'application SO.TE.CO ERP se lance automatiquement a la fin
4. Un raccourci "SO.TE.CO ERP" est cree sur le Bureau et dans le menu Demarrer

Connexion :
- Email : admin@sotec.local
- Mot de passe initial : ChangeMe123!  (a changer au premier acces)

Emplacements (un seul endroit propre)
-------------------------------------

Programme installe :
  C:\Users\<user>\AppData\Local\Programs\SO.TE.CO ERP\

Donnees utilisateur (base PostgreSQL embarquee, fichiers, logs) :
  C:\Users\<user>\AppData\Roaming\SO.TE.CO ERP\

Rien n'est ecrit ailleurs. Pas de fichiers sur le Bureau, pas de
modification du PATH systeme, pas d'entree dans Program Files
(installation par utilisateur, aucun droit administrateur requis).

Architecture interne
--------------------

L'application est un logiciel Windows complet : une fenetre native
SO.TE.CO ERP, pas de navigateur visible. A l'interieur tournent :
- un serveur web Next.js local (port 3000) qui dessine l'interface
- une API NestJS locale (port 4000)
- une base de donnees PostgreSQL embarquee (port 55432)

Tous les ports n'ecoutent que sur localhost. Aucune donnee ne quitte
la machine.

Pages
-----

- Tableau de bord    : /dashboard
- Clients            : /crm/clients
- Prospects          : /crm/leads
- Devis              : /sales/quotations
- Factures           : /sales/invoices
- Bons de livraison  : /sales/delivery-notes
- Chantiers          : /operations/projects
- Paiements          : /finance/payments
- Paiements ouvriers : /finance/worker-payments
- Depenses           : /finance/expenses
- Documents          : /documents
- Reglages           : /settings

Mise a jour
-----------

Livrer une nouvelle version de SO.TE.CO-ERP-Setup-<version>.exe.
L'installateur ecrase le programme et preserve les donnees du client
(la base reste dans AppData\Roaming\SO.TE.CO ERP\).

Sauvegarde
----------

Le menu de l'application offre une commande "Exporter la base".
La sauvegarde est ecrite dans :
  C:\Users\<user>\AppData\Roaming\SO.TE.CO ERP\.data\backups\

Desinstallation
---------------

Panneau de configuration -> Applications -> SO.TE.CO ERP -> Desinstaller

L'installateur supprime le programme. Les donnees client (factures,
devis, base de donnees) sont CONSERVEES par securite dans :
  C:\Users\<user>\AppData\Roaming\SO.TE.CO ERP\

Le client peut les supprimer manuellement si souhaite.

Diagnostic
----------

Si l'application refuse de demarrer, ouvrir dans la fenetre :
  Maintenance -> Lancer le preflight -> Exporter les diagnostics

Le rapport apparait dans :
  C:\Users\<user>\AppData\Roaming\SO.TE.CO ERP\.data\preflight.txt
