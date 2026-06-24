<!-- source_pdf_page: 1 -->
## John Baillieul Tariq Samad Editors-in-Chief

## Encyclopedia of Systems and <br> Control



<!-- source_pdf_page: 2 -->
Encyclopedia of Systems and Control



<!-- source_pdf_page: 3 -->


<!-- source_pdf_page: 4 -->
## John Baillieul • Tariq Samad <br> Editors

## Encyclopedia of Systems and Control

With 416 Figures and 21 Tables

Springer Reference



<!-- source_pdf_page: 5 -->
## Editors

John Baillieul<br>Mechanical Engineering<br>Electrical and Computer Engineering<br>Boston University<br>Boston, MA, USA

Tariq Samad<br>Honeywell Automation and<br>Control Solutions<br>Golden Valley, MN, USA

ISBN 978-1-4471-5057-2
ISBN 978-1-4471-5058-9 (eBook)
ISBN 978-1-4471-5059-6 (print and electronic bundle)
DOI 10.1007/978-1-4471-5058-9

Library of Congress Control Number: 2015941487

Springer London Heidelberg New York Dordrecht<br>© Springer-Verlag London 2015

This work is subject to copyright. All rights are reserved by the Publisher, whether the whole or part of the material is concerned, specifically the rights of translation, reprinting, reuse of illustrations, recitation, broadcasting, reproduction on microfilms or in any other physical way, and transmission or information storage and retrieval, electronic adaptation, computer software, or by similar or dissimilar methodology now known or hereafter developed.
The use of general descriptive names, registered names, trademarks, service marks, etc. in this publication does not imply, even in the absence of a specific statement, that such names are exempt from the relevant protective laws and regulations and therefore free for general use.
The publisher, the authors and the editors are safe to assume that the advice and information in this book are believed to be true and accurate at the date of publication. Neither the publisher nor the authors or the editors give a warranty, express or implied, with respect to the material contained herein or for any errors or omissions that may have been made.

Printed on acid-free paper
Springer-Verlag London is part of Springer Science+Business Media (www.springer.com)



<!-- source_pdf_page: 6 -->
## Preface

The history of Automatic Control is both ancient and modern. If we adopt the broad view that an automatic control system is any mechanism by which an input action and output action are dynamically coupled, then the origins of this encyclopedia's subject matter may be traced back more than 2,000 years to the era of primitive time-keeping and the clepsydra water clock perfected by Ctesibius of Alexandria. In more recent history, frequently cited examples of feedback control include the automatically refilling reservoirs of flush toilets (perfected in the late nineteenth century) and the celebrated flyball steam-flow governor described in J.C. Maxwell's 1868 Royal Society of London paper-"On Governors."

Although it is useful to keep the technologies of antiquity in mind, the history of systems and control as covered in the pages of this encyclopedia begins in the twentieth century. The history was profoundly influenced by work of Nyqvist, Black, Bode, and others who were developing amplifier theory in response to the need to transmit wireline signals over long distances. This research provided major conceptual advances in feedback and stability that proved to be of interest in the theory of servomechanisms that was being developed at the same time. Driven by the need for fast and accurate control of weapons systems during World War II, automatic control developed quickly as a recognizable discipline.

While the developments of the first half of the twentieth century are an important backdrop for the Encyclopedia of Systems and Control, most of the topics directly treat developments from 1948 to the present. The year 1948 was auspicious for systems and control-and indeed for all the information sciences. Norbert Wiener's book Cybernetics was published by Wiley, the transistor was invented (and given its name), and Shannon's seminal paper "A Mathematical Theory of Communication" was published in the Bell System Technical Journal. In the years that followed, important ideas of Shannon, Wiener, Von Neumann, Turing, and many others changed the way people thought about the basic concepts of control systems. The theoretical advances have propelled industrial and societal impact as well (and vice versa). Today, advanced control is a crucial enabling technology in domains as numerous and diverse as aerospace, automotive, and marine vehicles; the process industries and manufacturing; electric power systems; homes and buildings; robotics; communication networks; economics and finance; and biology and biomedical devices.



<!-- source_pdf_page: 7 -->
It is this incredible broadening of the scope of the field that has motivated the editors to assemble the entries that follow. This encyclopedia aims to help students, researchers, and practitioners learn the basic elements of a vast array of topics that are now considered part of systems and control. The goal is to provide entry-level access to subject matter together with cross-references to related topics and pointers to original research and source material.

Entries in the encyclopedia are organized alphabetically by title, and extensive links to related entries are included to facilitate topical readingthese links are listed in "Cross-References" sections within entries. All crossreferenced entries are indicated by a preceding symbol: ▷ . In the electronic version of the encyclopedia these entries are hyperlinked for ease of access.

The creation of the Encyclopedia of Systems and Control has been a major undertaking that has unfolded over a 3 -year period. We owe an enormous debt to major intellectual leaders in the field who agreed to serve as topical section editors. They have ensured the value of the opus by recruiting leading experts in each of the covered topics and carefully reviewing drafts. It has been a pleasure also to work with Oliver Jackson and Andrew Spencer of Springer, who have been unfailingly accommodating and responsive over this time.

As we reflect back over the course of this project, we are reminded of how it began. Gary Balas, one of the world's experts in robust control and aerospace applications, came to one of us after a meeting with Oliver at the Springer booth at a conference and suggested this encyclopedia-but was adamant that he wasn't the right person to lead it. The two of us took the initiative (ultimately getting Gary to agree to be the section editor for the aerospace control entries). Gary died last year after a courageous fight with cancer. Our sense of accomplishment is infused with sadness at the loss of a close friend and colleague.

We hope readers find this encyclopedia a useful and valuable compendium and we welcome your feedback.

Boston, USA
Minneapolis, USA
May 2015

John Baillieul
Tariq Samad



<!-- source_pdf_page: 8 -->
## Section Editors

Linear Systems Theory (Time-Domain)<br>Panos J. Antsaklis Department of Electrical Engineering, University of Notre Dame, Notre Dame, IN, USA<br>Aerospace Applications<br>Gary Balas Deceased. Formerly at Aerospace Engineering and Mechanics Department, University of Minnesota, Minneapolis, MN, USA<br>Game Theory<br>Tamer Başar Coordinated Science Laboratory, University of Illinois, Urbana, IL, USA<br>Economic and Financial Systems<br>Alain Bensoussan Naveen Jindal School of Management, University of Texas at Dallas, Richardson, TX, USA<br>Geometric Optimal Control<br>Anthony Bloch Department of Mathematics, The University of Michigan, Ann Arbor, MI, USA<br>Classical Optimal Control<br>Michael Cantoni Department of Electrical \& Electronic Engineering, The University of Melbourne, Parkville, VIC, Australia<br>Discrete-Event Systems<br>Christos G. Cassandras Division of Systems Engineering, Center for Information and Systems Engineering, Boston University, Brookline, MA, USA<br>Electric Energy Systems<br>Joe H. Chow Department of Electrical and Computer Systems Engineering, Rensselaer Polytechnic Institute, Troy, NY, USA<br>Control of Networked Systems<br>Jorge Cortés Department of Mechanical and Aerospace Engineering, University of California, San Diego, La Jolla, CA, USA



<!-- source_pdf_page: 9 -->
## Estimation and Filtering

Frederick E. Daum Raytheon Company, Woburn, MA, USA

## Control of Process Systems

Sebastian Engell Fakultät Bio- und Chemieingenieurwesen, Technische Universität Dortmund, Dortmund, Germany

## Automotive and Road Transportation

Luigi Glielmo Facoltà di Ingegneria dell'Università del Sannio in Benevento, Benevento, Italy

## Stochastic Control

Lei Guo Academy of Mathematics and Systems Science, Chinese Academy of Sciences (CAS), Beijing, China

## Nonlinear Control

Alberto Isidori Department of Computer and System Sciences "A. Ruberti", University of Rome "La Sapienza", Rome, Italy

## Biosystems and Control

Mustafa Khammash Department of Biosystems Science and Engineering, Swiss Federal Institute of Technology at Zurich (ETHZ), Basel, Switzerland

## Distributed Parameter Systems

Miroslav Krstic Department of Mechanical and Aerospace Engineering, University of California, San Diego, La Jolla, CA, USA

## Hybrid Systems

Francoise Lamnabhi-Lagarrigue Laboratoire des Signaux et Systèmes CNRS, European Embedded Control Institute, Gif-sur-Yvette, France

## Identification and Modeling

Lennart Ljung Division of Automatic Control, Department of Electrical Engineering, Linköping University, Linköping, Sweden

## Model-Predictive Control

David Mayne Department of Electrical and Electronic Engineering, Imperial College London, London, UK

## Adaptive Control

Richard Hume Middleton School of Electrical Engineering and Computer Science, The University of Newcastle, Callaghan, NSW, Australia

## Intelligent Control

Thomas Parisini Department of Electrical and Electronic Engineering, Imperial College London, London, UK



<!-- source_pdf_page: 10 -->
## Control of Marine Vessels

Kristin Y. Pettersen Department of Engineering Cybernetics, Norwegian University of Science and Technology, Trondheim, Norway

## Frequency-Domain Control

Michael Sebek Department of Control Engineering, Faculty of Electrical Engineering, Czech Technical University in Prague, Prague 6, Czech Republic

## Robotics

Bruno Siciliano Dipartimento di Informatica e Sistemistica, Università degli Studi di Napoli Federico II, Napoli, Italy

## Other Applications of Advanced Control

Toshiharu Sugie Department of Systems Science, Graduate School of Informatics, Kyoto University, Uji, Kyoto, Japan

## Complex Systems with Uncertainty

Roberto Tempo CNR-IEIIT, Politecnico di Torino, Torino, Italy

## Control of Manufacturing Systems

Dawn Tilbury Department of Mechanical Engineering, University of Michigan, Ann Arbor, MI, USA

## Computer-Aided Control Systems Design

Andreas Varga Institute of System Dynamics and Control, German Aerospace Center, DLR Oberpfaffenhofen, Wessling, Germany

## Information-Based Control

Wing-Shing Wong Department of Information Engineering, The Chinese University of Hong Kong, Hong Kong, China

## Robust Control

Kemin Zhou Department of Electrical and Computer Engineering, Louisiana State University, Baton Rouge, LA, USA



<!-- source_pdf_page: 11 -->


<!-- source_pdf_page: 12 -->
## Contributors

Teodoro Alamo Departamento de Ingeniería de Sistemas y Automática, Escuela Superior de Ingeniería, Universidad de Sevilla, Sevilla, Spain

Frank Allgöwer Institute for Systems Theory and Automatic Control, University of Stuttgart, Stuttgart, Germany

Tansu Alpcan Department of Electrical and Electronic Engineering, The University of Melbourne, Melbourne, Australia

Eitan Altman INRIA, Sophia-Antipolis, France
Sean B. Andersson Mechanical Engineering and Division of Systems Engineering, Boston University, Boston, MA, USA

David Angeli Department of Electrical and Electronic Engineering, Imperial College London, London, UK

Dipartimento di Ingegneria dell'Informazione, University of Florence, Italy
Finn Ankersen European Space Agency, Noordwijk, The Netherlands
Anuradha M. Annaswamy Active-adaptive Control Laboratory, Department of Mechanical Engineering, Massachusetts Institute of Technology, Cambridge, MA, USA

Gianluca Antonelli University of Cassino and Southern Lazio, Cassino, Italy

Panos J. Antsaklis Department of Electrical Engineering, University of Notre Dame, Notre Dame, IN, USA

Pierre Apkarian DCSD, ONERA - The French Aerospace Lab, Toulouse, France
A. Astolfi Department of Electrical and Electronic Engineering, Imperial College London, London, UK

Dipartimento di Ingegneria Civile e Ingegneria Informatica, Università di Roma Tor Vergata, Roma, Italy
Karl Åström Department of Automatic Control, Lund University, Lund, Sweden



<!-- source_pdf_page: 13 -->
Thomas A. Badgwell ExxonMobil Research \& Engineering, Annandale, NJ, USA

John Baillieul Mechanical Engineering, Electrical and Computer Engineering, Boston University, Boston, MA, USA

Gary Balas Deceased. Formerly at Aerospace Engineering and Mechanics Department, University of Minnesota, Minneapolis, MN, USA

Yaakov Bar-Shalom University of Connecticut, Storrs, CT, USA
B. Ross Barmish University of Wisconsin, Madison, WI, USA

Tamer Başar Coordinated Science Laboratory, University of Illinois, Urbana, IL, USA

Georges Bastin Department of Mathematical Engineering, University Catholique de Louvain, Louvain-La-Neuve, Belgium

Karine Beauchard CNRS, CMLS, Ecole Polytechnique, Palaiseau, France
Nikolaos Bekiaris-Liberis Department of Mechanical and Aerospace Engineering, University of California, San Diego, La Jolla, CA, USA

Christine M. Belcastro NASA Langley Research Center, Hampton, VA, USA

Alberto Bemporad IMT Institute for Advanced Studies Lucca, Lucca, Italy
Peter Benner Max Planck Institute for Dynamics of Complex Technical Systems, Magdeburg, Germany

Pierre Bernhard INRIA-Sophia Antipolis Méditerranée, Sophia Antipolis, France

Tomasz R. Bielecki Department of Applied Mathematics, Illinois Institute of Technology, Chicago, IL, USA

Mogens Blanke Department of Electrical Engineering, Automation and Control Group, Technical University of Denmark (DTU), Lyngby, Denmark

Centre for Autonomous Marine Operations and Systems (AMOS), Norwegian University of Science and Technology, Trondheim, Norway

Anthony Bloch Department of Mathematics, The University of Michigan, Ann Arbor, MI, USA

Bernard Bonnard Institute of Mathematics, University of Burgundy, Dijon, France

Dominique Bonvin Laboratoire d'Automatique, École Polytechnique Fédérale de Lausanne (EPFL), 1015 Lausanne, Switzerland

Ugo Boscain CNRS CMAP, École Polytechnique, Palaiseau, France
Team GECO INRIA Saclay, Palaiseau, France
James E. Braun Purdue University, West Lafayette, IN, USA



<!-- source_pdf_page: 14 -->
Roger Brockett Harvard University, Cambridge, MA, USA
Linda Bushnell Department of Electrical Engineering, University of Washington, Seattle, WA, USA

Fabrizio Caccavale School of Engineering, Università degli Studi della Basilicata, Potenza, Italy

Abel Cadenillas University of Alberta, Edmonton, AB, Canada
Peter E. Caines McGill University, Montreal, QC, Canada
Andrea Caiti DII - Department of Information Engineering \& Centro "E. Piaggio", ISME - Interuniversity Research Centre on Integrated Systems for the Marine Environment, University of Pisa, Pisa, Italy

Octavia Camps Electrical and Computer Engineering Department, Northeastern University, Boston, MA, USA

Mark Cannon Department of Engineering Science, University of Oxford, Oxford, UK

Michael Cantoni Department of Electrical \& Electronic Engineering, The University of Melbourne, Parkville, VIC, Australia

Xi-Ren Cao Department of Finance and Department of Automation, Shanghai Jiao Tong University, Shanghai, China

Institute of Advanced Study, Hong Kong University of Science and Technology, Hong Kong, China

Daniele Carnevale Dipartimento di Ing. Civile ed Ing. Informatica, Università di Roma "Tor Vergata", Roma, Italy

Giuseppe Casalino University of Genoa, Genoa, Italy
Francesco Casella Politecnico di Milano, Milan, Italy
Christos G. Cassandras Division of Systems Engineering, Center for Information and Systems Engineering, Boston University, Brookline, MA, USA

David A. Castañón Boston University, Boston, MA, USA
Eduardo Cerpa Departamento de Matemática, Universidad Técnica Federico Santa María, Valparaiso, Chile

François Chaumette Inria, Rennes, France
Ben M. Chen Department of Electrical and Computer Engineering, National University of Singapore, Singapore, Singapore

Jie Chen City University of Hong Kong, Hong Kong, China
Tongwen Chen Department of Electrical and Computer Engineering, University of Alberta, Edmonton, AB, Canada

Benoit Chevalier-Roignant Oliver Wyman, Munich, Germany



<!-- source_pdf_page: 15 -->
Hsiao-Dong Chiang School of Electrical and Computer Engineering, Cornell University, Ithaca, NY, USA

Stefano Chiaverini Dipartimento di Ingegneria Elettrica e dell'Informazione "Maurizio Scarano", Università degli Studi di Cassino e del Lazio Meridionale, Cassino (FR), Italy

Luigi Chisci Dipartimento di Ingegneria dell'Informazione, Università di Firenze, Firenze, Italy

Alessandro Chiuso Department of Information Engineering, University of Padova, Padova, Italy

Joe H. Chow Department of Electrical and Computer Systems Engineering, Rensselaer Polytechnic Institute, Troy, NY, USA

Monique Chyba University of Hawaii-Manoa, Manoa, HI, USA
Martin Corless School of Aeronautics \& Astronautics, Purdue University, West Lafayette, IN, USA

Jean-Michel Coron Laboratoire Jacques-Louis Lions, University Pierre et Marie Curie, Paris, France

Jorge Cortés Department of Mechanical and Aerospace Engineering, University of California, San Diego, La Jolla, CA, USA

Fabrizio Dabbene CNR-IEIIT, Politecnico di Torino, Torino, Italy
Mark L. Darby CMiD Solutions, Houston, TX, USA
Frederick E. Daum Raytheon Company, Woburn, MA, USA
David Martin De Diego Instituto de Ciencias Matemáticas (CSIC-UAM-UC3M-UCM), Madrid, Spain

Alessandro De Luca Sapienza Università di Roma, Roma, Italy
Cesar de Prada Departamento de Ingeniería de Sistemas y Automática, University of Valladolid, Valladolid, Spain

Enrique Del Castillo Department of Industrial and Manufacturing Engineering, The Pennsylvania State University, University Park, PA, USA

Luigi del Re Johannes Kepler Universität, Linz, Austria
Domitilla Del Vecchio Department of Mechanical Engineering, Massachusetts Institute of Technology, Cambridge, MA, USA

Moritz Diehl Department of Microsystems Engineering (IMTEK), University of Freiburg, Freiburg, Germany

ESAT-STADIUS/OPTEC, KU Leuven, Leuven-Heverlee, Belgium
Steven X. Ding University of Duisburg-Essen, Duisburg, Germany
Ian Dobson Iowa State University, Ames, IA, USA



<!-- source_pdf_page: 16 -->
Alejandro D. Domínguez-García University of Illinois at UrbanaChampaign, Urbana-Champaign, IL, USA

Sebastian Dormido Departamento de Informatica y Automatica, UNED, Madrid, Spain

Tyrone Duncan Department of Mathematics, University of Kansas, Lawrence, KS, USA

Alexander Efremov Moscow Aviation Institute, Moscow, Russia
Magnus Egerstedt Georgia Institute of Technology, Atlanta, GA, USA
Naomi Ehrich Leonard Department of Mechanical and Aerospace Engineering, Princeton University, Princeton, NJ, USA

Abbas Emami-Naeini Stanford University, Stanford, CA, USA
Sebastian Engell Fakultät Bio- und Chemieingenieurwesen, Technische Universität Dortmund, Dortmund, Germany

Dale Enns Honeywell International Inc., Minneapolis, MN, USA
Kaan Erkorkmaz Department of Mechanical \& Mechatronics Engineering, University of Waterloo, Waterloo, ON, Canada

Fabio Fagnani Dipartimento di Scienze Matematiche 'G.L. Lagrange', Politecnico di Torino, Torino, Italy

Maurizio Falcone Dipartimento di Matematica, SAPIENZA - Università di Roma, Rome, Italy

Paolo Falcone Department of Signals and Systems, Mechatronics Group, Chalmers University of Technology, Göteborg, Sweden

Alfonso Farina Selex ES, Roma, Italy
Heike Faßbender Institut Computational Mathematics, Technische Universität Braunschweig, Braunschweig, Germany

Augusto Ferrante Dipartimento di Ingegneria dell'Informazione, Università di Padova, Padova, Italy

Thor I. Fossen Department of Engineering Cyberentics, Centre for Autonomous Marine Operations and Systems, Norwegian University of Science and Technology, Trondheim, Norway

Bruce A. Francis Department of Electrical and Computer Engineering, University of Toronto, Toronto, ON, Canada

Emilio Frazzoli Massachusetts Institute of Technology, Cambridge, MA, USA

Georg Frey Saarland University, Saarbrücken, Germany
Minyue Fu School of Electrical Engineering and Computer Science, University of Newcastle, Callaghan, NSW, Australia



<!-- source_pdf_page: 17 -->
Sergio Galeani Dipartimento di Ingegneria Civile e Ingegneria Informatica, Università di Roma "Tor Vergata", Roma, Italy

Mario Garcia-Sanz Case Western Reserve University, Cleveland, OH, USA
Janos Gertler George Mason University, Fairfax, VA, USA
Alessandro Giua DIEE, University of Cagliari, Cagliari, Italy
LSIS, Aix-en-Provence, France
S. Torkel Glad Department of Electrical Engineering, Linköping University, Linköping, Sweden

Keith Glover Department of Engineering, University of Cambridge, Cambridge, UK

Ambarish Goswami Honda Research Institute, Mountain View, CA, USA
Pulkit Grover Carnegie Mellon University, Pittsburgh, PA, USA
Lars Grüne Mathematical Institute, University of Bayreuth, Bayreuth, Germany

Vijay Gupta Department of Electrical Engineering, University of Notre Dame, Notre Dame, IN, USA

Fredrik Gustafsson Division of Automatic Control, Department of Electrical Engineering, Linköping University, Linköping, Sweden

Christoforos N. Hadjicostis University of Cyprus, Nicosia, Cyprus
Tore Hägglund Lund University, Lund, Sweden
Christine Haissig Honeywell International Inc., Minneapolis, MN, USA
Bruce Hajek University of Illinois, Urbana, IL, USA
Alain Haurie ORDECSYS and University of Geneva, Switzerland
GERAD-HEC Montréal PQ, Canada
W.P.M.H. Heemels Department of Mechanical Engineering, Eindhoven University of Technology, Eindhoven, The Netherlands

Didier Henrion LAAS-CNRS, University of Toulouse, Toulouse, France
Faculty of Electrical Engineering, Czech Technical University in Prague, Prague, Czech Republic

João P. Hespanha Center for Control, Dynamical Systems and Computation, University of California, Santa Barbara, CA, USA

Håkan Hjalmarsson School of Electrical Engineering, ACCESS Linnaeus Center, KTH Royal Institute of Technology, Stockholm, Sweden

Ying Hu IRMAR, Université Rennes 1, Rennes Cedex, France
Luigi Iannelli Università degli Studi del Sannio, Benevento, Italy



<!-- source_pdf_page: 18 -->
Pablo A. Iglesias Electrical \& Computer Engineering, The Johns Hopkins University, Baltimore, MD, USA

Petros A. Ioannou University of Southern California, Los Angeles, CA, USA

Hideaki Ishii Tokyo Institute of Technology, Yokohama, Japan
Alberto Isidori Department of Computer and System Sciences "A. Ruberti", University of Rome "La Sapienza", Rome, Italy

Tetsuya Iwasaki Department of Mechanical \& Aerospace Engineering, University of California, Los Angeles, CA, USA

Ali Jadbabaie University of Pennsylvania, Philadelphia, PA, USA
Monique Jeanblanc Laboratoire Analyse et Probabilités, IBGBI, Université d'Evry Val d'Essonne, Evry Cedex, France

Karl H. Johansson ACCESS Linnaeus Center, Royal Institute of Technology, Stockholm, Sweden

Ramesh Johari Stanford University, Stanford, CA, USA
Mihailo R. Jovanović Department of Electrical and Computer Engineering, University of Minnesota, Minneapolis, MN, USA

Hans-Michael Kaltenbach ETH Zürich, Basel, Switzerland
Christoph Kawan Courant Institute of Mathematical Sciences, New York University, New York, USA

Matthias Kawski School of Mathematical and Statistical Sciences, Arizona State University, Tempe, AZ, USA

Hassan K. Khalil Department of Electrical and Computer Engineering, Michigan State University, East Lansing, MI, USA

Mustafa Khammash Department of Biosystems Science and Engineering, Swiss Federal Institute of Technology at Zurich (ETHZ), Basel, Switzerland

Rudibert King Technische Universität Berlin, Berlin, Germany
Basil Kouvaritakis Department of Engineering Science, University of Oxford, Oxford, UK
A.J. Krener Department of Applied Mathematics, Naval Postgrauate School, Monterey, CA, USA

Miroslav Krstic Department of Mechanical and Aerospace Engineering, University of California, San Diego, La Jolla, CA, USA

Vladimír Kučera Faculty of Electrical Engineering, Czech Technical University of Prague, Prague, Czech Republic

Stéphane Lafortune Department of Electrical Engineering and Computer Science, University of Michigan, Ann Arbor, MI, USA



<!-- source_pdf_page: 19 -->
Frank L. Lewis Arlington Research Institute, University of Texas, Fort Worth, TX, USA

Daniel Limon Departamento de Ingeniería de Sistemas y Automática, Escuela Superior de Ingeniería, Universidad de Sevilla, Sevilla, Spain

Kang-Zhi Liu Department of Electrical and Electronic Engineering, Chiba University, Chiba, Japan

Lennart Ljung Division of Automatic Control, Department of Electrical Engineering, Linköping University, Linköping, Sweden

Marco Lovera Politecnico di Milano, Milan, Italy
J. Lygeros Automatic Control Laboratory, Swiss Federal Institute of Technology Zurich (ETHZ), Zurich, Switzerland

Kevin M. Lynch Mechanical Engineering Department, Northwestern University, Evanston, IL, USA

Ronald Mahler Eagan, MN, USA
Lorenzo Marconi C.A.SY. Ü- DEI, University of Bologna, Bologna, Italy
Sonia Martínez Department of Mechanical and Aerospace Engineering, University of California, La Jolla, San Diego, CA, USA

Wolfgang Mauntz Fakultät Bio- und Chemieingenieurwesen, Technische Universität Dortmund, Dortmund, Germany

Volker Mehrmann Institut für Mathematik MA 4-5, Technische Universität Berlin, Berlin, Germany

Claudio Melchiorri Dipartimento di Ingegneria dell'Energia Elettrica e dell'Informazione, Alma Mater Studiorum Università di Bologna, Bologna, Italy

Mehran Mesbahi University of Washington, Seattle, WA, USA
Alexandre R. Mesquita Department of Electronics Engineering, Federal University of Minas Gerais, Belo Horizonte, Brazil

Thomas Meurer Faculty of Engineering, Christian-Albrechts-University Kiel, Kiel, Germany

Wim Michiels KU Leuven, Leuven (Heverlee), Belgium
Richard Hume Middleton School of Electrical Engineering and Computer Science, The University of Newcastle, Callaghan, NSW, Australia
S.O. Reza Moheimani School of Electrical Engineering \& Computer Science, The University of Newcastle, Callaghan, NSW, Australia

Julian Morris School of Chemical Engineering and Advanced Materials, Centre for Process Analytics and Control Technology, Newcastle University, Newcastle Upon Tyne, UK

James Moyne Mechanical Engineering Department, University of Michigan, Ann Arbor, MI, USA



<!-- source_pdf_page: 20 -->
Curtis P. Mracek Raytheon Missile Systems, Waltham, MA, USA
Richard M. Murray Control and Dynamical Systems, Caltech, Pasadena, CA, USA

Hideo Nagai Osaka University, Osaka, Japan
Girish N. Nair Department of Electrical \& Electronic Engineering, University of Melbourne, Melbourne, VIC, Australia

Angelia Nedić Industrial and Enterprise Systems Engineering, University of Illinois, Urbana, IL, USA

Arye Nehorai Preston M. Green Department of Electrical and Systems Engineering, Washington University in St. Louis, St. Louis, MO, USA

Dragan Nesic Department of Electrical and Electronic Engineering, The University of Melbourne, Melbourne, VIC, Australia

Brett Ninness School of Electrical and Computer Engineering, University of Newcastle, Newcastle, Australia

Hidekazu Nishimura Graduate School of System Design and Management, Keio University, Yokohama, Japan

Dominikus Noll Institut de Mathématiques, Université de Toulouse, Toulouse, France

Lorenzo Ntogramatzidis Department of Mathematics and Statistics, Curtin University, Perth, WA, Australia

Giuseppe Oriolo Sapienza Università di Roma, Roma, Italy
Richard W. Osborne University of Connecticut, Storrs, CT, USA
Martin Otter Institute of System Dynamics and Control, German Aerospace Center (DLR), Wessling, Germany

David H. Owens University of Sheffield, Sheffield, UK
Hitay Özbay Department of Electrical and Electronics Engineering, Bilkent University, Ankara, Turkey

Asuman Ozdaglar Laboratory for Information and Decision Systems, Department of Electrical Engineering and Computer Science, Massachusetts Institute of Technology, Cambridge, MA, USA

Andrew Packard Mechanical Engineering Department, University of California, Berkeley, CA, USA

Fernando Paganini Universidad ORT Uruguay, Montevideo, Uruguay
Gabriele Pannocchia University of Pisa, Pisa, Italy
Lucy Y. Pao University of Colorado, Boulder, CO, USA
George J. Pappas Department of Electrical and Systems Engineering, University of Pennsylvania, Philadelphia, PA, USA



<!-- source_pdf_page: 21 -->
Frank C. Park Robotics Laboratory, Seoul National University, Seoul, Korea

Bozenna Pasik-Duncan Department of Mathematics, University of Kansas, Lawrence, KS, USA

Ron J. Patton School of Engineering, University of Hull, Hull, UK
Marco Pavone Stanford University, Stanford, CA, USA
Shige Peng Shandong University, Jinan, Shandong Province, China
Tristan Perez Electrical Engineering \& Computer Science, Queensland University of Technology, Brisbane, QLD, Australia

Ian R. Petersen School of Engineering and Information Technology, University of New South Wales, the Australian Defence Force Academy, Canberra, Australia

Kristin Y. Pettersen Department of Engineering Cybernetics, Norwegian University of Science and Technology, Trondheim, Norway

Benedetto Piccoli Mathematical Sciences and Center for Computational and Integrative Biology, Rutgers University, Camden, NJ, USA

Rik Pintelon Department ELEC, Vrije Universiteit Brussel, Brussels, Belgium

Boris Polyak Institute of Control Science, Moscow, Russia
Romain Postoyan Université de Lorraine, CRAN, France
CNRS, CRAN, France
J. David Powell Stanford University, Stanford, CA, USA

Laurent Praly MINES ParisTech, PSL Research University, CAS, Fontainebleau, France

Domenico Prattichizzo University of Siena, Siena, Italy
James A. Primbs University of Texas at Dallas, Richardson, TX, USA
S. Joe Qin University of Southern California, Los Angeles, CA, USA

Li Qiu Hong Kong University of Science and Technology, Hong Kong SAR, China

Rajesh Rajamani Department of Mechanical Engineering, University of Minnesota, Twin Cities, Minneapolis, MN, USA

Saša Raković Oxford University, Oxford, UK
James B. Rawlings University of Wisconsin, Madison, WI, USA
Jean-Pierre Raymond Institut de Mathématiques, Université Paul Sabatier Toulouse III \& CNRS, Toulouse Cedex, France



<!-- source_pdf_page: 22 -->
Wei Ren Department of Electrical Engineering, University of California, Riverside, CA, USA

Spyros Reveliotis School of Industrial \& Systems Engineering, Georgia Institute of Technology, Atlanta, GA, USA

Giorgio Rizzoni Department of Mechanical and Aerospace Engineering, Center for Automotive Research, The Ohio State University, Columbus, OH, USA
L.C.G. Rogers University of Cambridge, Cambridge, UK

Pierre Rouchon Centre Automatique et Systèmes, Mines ParisTech, Paris Cedex 06, France

Ricardo G. Sanfelice Department of Computer Engineering, University of California at Santa Cruz, Santa Cruz, CA, USA

Heinz Schättler Washington University, St. Louis, MO, USA
Thomas B. Schön Department of Information Technology, Uppsala University, Uppsala, Sweden

Johan Schoukens Department ELEC, Vrije Universiteit Brussel, Brussels, Belgium

Michael Sebek Department of Control Engineering, Faculty of Electrical Engineering, Czech Technical University in Prague, Prague 6, Czech Republic

Peter Seiler Aerospace Engineering and Mechanics Department, University of Minnesota, Minneapolis, MN, USA

Suresh P. Sethi Jindal School of Management, The University of Texas at Dallas, Richardson, TX, USA

Sirish L. Shah Department of Chemical and Materials Engineering, University of Alberta Edmonton, Edmonton, AB, Canada

Jeff S. Shamma School of Electrical and Computer Engineering, Georgia Institute of Technology, Atlanta, GA, USA

Pavel Shcherbakov Institute of Control Science, Moscow, Russia
Jianjun Shi Georgia Institute of Technology, Atlanta, GA, USA
Manuel Silva Instituto de Investigation en Ingeniería de Aragón (I3A), Universidad de Zaragoza, Zaragoza, Spain

Vasile Sima Advanced Research, National Institute for Research \& Development in Informatics, Bucharest, Romania

Robert E. Skelton University of California, San Diego, CA, USA
Sigurd Skogestad Department of Chemical Engineering, Norwegian University of Science and Technology (NTNU), Trondheim, Norway



<!-- source_pdf_page: 23 -->
Eduardo D. Sontag Rutgers University, New Brunswick, NJ, USA
Asgeir J. Sørensen Department of Marine Technology, Centre for Autonomous Marine Operations and Systems (AMOS), Norwegian University of Science and Technology, NTNU, Trondheim, Norway

Mark W. Spong Erik Jonsson School of Engineering and Computer Science, The University of Texas at Dallas, Richardson, TX, USA
R. Srikant Department of Electrical and Computer Engineering and the Coordinated Science Lab, University of Illinois at Urbana-Champaign, Champaign, IL, USA

Jörg Stelling ETH Zürich, Basel, Switzerland
Jing Sun University of Michigan, Ann Arbor, MI, USA
Krzysztof Szajowski Faculty of Fundamental Problems of Technology, Institute of Mathematics and Computer Science, Wroclaw University of Technology, Wroclaw, Poland

Mario Sznaier Electrical and Computer Engineering Department, Northeastern University, Boston, MA, USA

Paulo Tabuada Department of Electrical Engineering, University of California, Los Angeles, CA, USA

Satoshi Tadokoro Tohoku University, Sendai, Japan
Gongguo Tang Department of Electrical Engineering \& Computer Science, Colorado School of Mines, Golden, CO, USA

Shanjian Tang Fudan University, Shanghai, China
Andrew R. Teel Electrical and Computer Engineering Department, University of California, Santa Barbara, CA, USA

Roberto Tempo CNR-IEIIT, Politecnico di Torino, Torino, Italy
Onur Toker Fatih University, Istanbul, Turkey
H.L. Trentelman Johann Bernoulli Institute for Mathematics and Computer Science, University of Groningen, Groningen, AV, The Netherlands

Jorge Otávio Trierweiler Group of Intensification, Modelling, Simulation, Control and Optimization of Processes (GIMSCOP), Department of Chemical Engineering, Federal University of Rio Grande do Sul (UFRGS), Porto Alegre, RS, Brazil

Lenos Trigeorgis University of Cyprus, Nicosia, Cyprus
Eric Tseng Ford Motor Company, Dearborn, MI, USA
Kyriakos G. Vamvoudakis Center for Control, Dynamical Systems and Computation (CCDC), University of California, Santa Barbara, CA, USA



<!-- source_pdf_page: 24 -->
Paul Van Dooren ICTEAM: Department of Mathematical Engineering, Catholic University of Louvain, Louvain-la-Neuve, Belgium
O. Arda Vanli Department of Industrial and Manufacturing Engineering, High Performance Materials Institute Florida A\&M University and Florida State University, Tallahassee, FL, USA

Andreas Varga Institute of System Dynamics and Control, German Aerospace Center, DLR Oberpfaffenhofen, Wessling, Germany

Michel Verhaegen Delft Center for Systems and Control, Delft University, Delft, The Netherlands

Mathukumalli Vidyasagar University of Texas at Dallas, Richardson, TX, USA

Luigi Villani Dipartimento di Ingeneria Elettrica e Tecnologie dell' Informazione, Università degli Studi di Napoli Federico II, Napoli, Italy

Richard B. Vinter Imperial College, London, UK
Antonio Visioli Dipartimento di Ingegneria Meccanica e Industriale, University of Brescia, Brescia, Italy

Vijay Vittal Arizona State University, Tempe, AZ, USA
Costas Vournas School of Electrical and Computer Engineering, National Technical University of Athens, Zografou, Greece

Steffen Waldherr Institute for Automation Engineering, Otto-von-Guericke-Universität Magdgeburg, Magdeburg, Germany

Fred Wang University of Tennessee, Knoxville, TN, USA
Yorai Wardi School of Electrical and Computer Engineering, Georgia Institute of Technology, Atlanta, GA, USA

John M. Wassick The Dow Chemical Company, Midland, MI, USA
Wing-Shing Wong Department of Information Engineering, The Chinese University of Hong Kong, Hong Kong, China
W.M. Wonham Department of Electrical \& Computer Engineering, University of Toronto, Toronto, ON, Canada

Yutaka Yamamoto Department of Applied Analysis and Complex Dynamical Systems, Graduate School of Informatics, Kyoto University, Kyoto, Japan

Hong Ye The Mathworks, Inc., Natick, MA, USA
George Yin Department of Mathematics, Wayne State University, Detroit, MI, USA

Serdar Yüksel Department of Mathematics and Statistics, Queen's University, Kingston, ON, Canada



<!-- source_pdf_page: 25 -->
Michael M. Zavlanos Department of Mechanical Engineering and Materials Science, Duke University, Durham, NC, USA

Qing Zhang Department of Mathematics, The University of Georgia, Athens, GA, USA

Qinghua Zhang Inria, Campus de Beaulieu, Rennes Cedex, France
