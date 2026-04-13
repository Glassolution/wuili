-- CLIENTES
insert into clientes (nome) values
('Ana Souza'),('Bruno Ferreira'),('Camila Santos'),('Diego Oliveira'),
('Elisa Martins'),('Felipe Costa'),('Gabriela Lima'),('Henrique Alves'),
('Isabela Nunes'),('João Pedro Silva'),('Karla Mendes'),('Lucas Rocha'),
('Marina Carvalho'),('Nathan Ribeiro'),('Olívia Castro'),('Paulo Gomes'),
('Queila Andrade'),('Rafael Torres'),('Sandra Pereira'),('Thiago Moura'),
('Úrsula Barros'),('Victor Nascimento'),('Wanessa Dias'),('Xavier Correia'),
('Yasmin Freitas')
on conflict (nome) do nothing;

-- PRODUTOS (únicos)
insert into produtos (nome, categoria, fornecedor, pais_fornecedor, custo) values
('Fone Bluetooth TWS Pro','Eletrônicos','ShenTech Electronics','China',42.00),
('Tênis Running Lite','Moda','Footwear Global','Vietnam',35.00),
('LEGO Compatível City','Brinquedos','BrickMaster Supply','China',25.00),
('Luminária LED de Mesa','Casa','BrightHome Ltd','China',30.00),
('Bolsa Crossbody Couro','Moda','LeatherCraft Asia','China',28.00),
('Vela Aromática Lavanda','Casa','Aromas World','França',10.00),
('Perfume Árabe Oud','Beleza','Arabian Scents','Emirados',60.00),
('Squeeze Térmica 600ml','Esportes','ThermoSport Ltd','China',20.00),
('Luva de Boxe Pro','Esportes','FightGear Co','Paquistão',55.00),
('Jaqueta Corta-Vento','Moda','OutdoorFashion Co','Vietnam',48.00),
('Elástico de Resistência Set','Esportes','FitGear Wholesale','China',16.00),
('Máscara Capilar Repair','Beleza','HairCare Global','EUA',18.00),
('Organizador de Gaveta','Casa','HomeOrg Solutions','China',15.00),
('Capa iPhone 15 Magnética','Eletrônicos','CasePro Supplies','China',8.00),
('Protetor Solar FPS 60','Beleza','SunShield Co','Coreia do Sul',25.00),
('Jogo de Toalhas Premium','Casa','TextilBrasil Dist','Brasil',45.00),
('Kit Pincéis Maquiagem','Beleza','BeautyTool Supply','China',14.00),
('Tapete Antiderrapante','Casa','SafeStep Imports','China',20.00),
('Smartwatch Fitness Band X3','Eletrônicos','GuangZhou Wearables','China',68.00),
('Carregador Turbo 65W GaN','Eletrônicos','PowerMax Tech','China',22.00),
('Carrinho Controle Remoto','Brinquedos','SpeedToy Intl','China',42.00),
('Camiseta Oversized Drop','Moda','UrbanWear Wholesale','Bangladesh',12.00),
('Boneca Interativa Fala','Brinquedos','ToyWorld Factory','China',38.00),
('Sérum Vitamina C','Beleza','Dermis Labs','Coreia do Sul',22.00),
('Webcam Full HD 1080p','Eletrônicos','VisionTech Ltd','China',55.00)
on conflict do nothing;
