# -*- coding: utf-8 -*-
"""Telescope model module."""
from sqlalchemy import *
from sqlalchemy import Table, ForeignKey, Column
from sqlalchemy.types import Integer, Float, Unicode, DateTime, LargeBinary
from sqlalchemy.orm import relationship, backref

from icrar.model import DeclarativeBase, metadata, DBSession


class Telescope(DeclarativeBase):
    __tablename__ = 'telescopes'

    uid = Column(Integer, primary_key=True)
    name = Column(Unicode(255), nullable=False)
    integration_time = Column(Integer, nullable=False)
    frequency = Column(Float, nullable=False)
    bandwidth = Column(Float, nullable=False)
    nat_beam = Column(Float, nullable=False)
    nat_rms = Column(Float, nullable=False)
    nat_nhi = Column(Float, nullable=False)
    nat_ss = Column(Float, nullable=False)

__all__ = ['Telescope']
